<?php

/**
 * Endpoint de retención del video.
 *
 * Recibe los hitos que manda `src/lib/retencion.ts` por `navigator.sendBeacon`
 * y los guarda en MySQL. Analítica de primera parte, anónima: no se recibe ni
 * se guarda IP, user-agent ni ningún dato personal — solo el hito del video,
 * el segundo y la campaña de origen. Por eso no necesita consentimiento de
 * cookies y mide al 100% de los visitantes.
 *
 * Reglas que se siguen acá:
 *   - Toda validación del navegador se repite acá. Lo del navegador es cortesía.
 *   - Prepared statements siempre.
 *   - Los mensajes de error que ve el cliente son genéricos; el detalle va al log.
 *   - Cero secretos publicados: las credenciales viven fuera del docroot.
 *
 * Esquema de la tabla: ver `esquema.sql` en esta misma carpeta.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const MAX_CUERPO_BYTES = 8192;   // ~100 hitos holgados; más que eso es abuso
const MAX_HITOS_POR_LOTE = 60;
const LIMITE_PETICIONES = 120;   // por IP y ventana
const VENTANA_LIMITE_SEG = 300;

const EVENTOS_VALIDOS = ['inicio', 'progreso', 'pitch', 'clic_cta', 'fin'];

/** Respuesta genérica. El detalle real, si lo hay, ya fue al log. */
function salir(int $codigo, string $estado, ?int $guardados = null): void
{
    http_response_code($codigo);
    $cuerpo = ['estado' => $estado];
    if ($guardados !== null) {
        $cuerpo['guardados'] = $guardados;
    }
    echo json_encode($cuerpo);
    exit;
}

function fallar(int $codigo, string $paraElLog): void
{
    error_log('[retencion] ' . $paraElLog);
    salir($codigo, 'error');
}

// ── Método y tamaño ───────────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    salir(405, 'metodo_no_permitido');
}

$longitud = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($longitud > MAX_CUERPO_BYTES) {
    salir(413, 'cuerpo_demasiado_grande');
}

// ── Origen ────────────────────────────────────────────────────────────
// sendBeacon en same-origin puede no mandar Origin, así que la ausencia no
// se castiga; lo que se rechaza es un Origin que exista y no sea el nuestro.

$hostPropio = $_SERVER['HTTP_HOST'] ?? '';
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origen !== '') {
    $hostOrigen = parse_url($origen, PHP_URL_HOST) ?: '';
    if ($hostOrigen === '' || strcasecmp($hostOrigen, (string) preg_replace('/:\d+$/', '', $hostPropio)) !== 0) {
        salir(403, 'origen_no_permitido');
    }
}

// ── Config y conexión ─────────────────────────────────────────────────
// El archivo vive FUERA del docroot para que no sea alcanzable por URL ni
// aunque el servidor deje de interpretar PHP. En Hostinger va en el home,
// un nivel arriba de public_html. Ver config-retencion.ejemplo.php.

// Se busca subiendo carpeta a carpeta, en vez de con rutas fijas. El motivo
// es concreto: con dos rutas fijas ('../..' y '../') esto funcionaba mientras
// el sitio colgaba de public_html, pero al mover la landing a
// public_html/clase/ apareció un nivel más y el config dejó de encontrarse —
// la analítica se cayó entera sin que nada más cambiara. Recorriendo hacia
// arriba, da igual a qué profundidad se despliegue el sitio.
$config = null;
$dir = __DIR__;
for ($i = 0; $i < 6; $i++) {
    $dir = dirname($dir);
    if ($dir === '/' || $dir === '.') {
        break;
    }
    $ruta = $dir . '/config-retencion.php';
    if (is_readable($ruta)) {
        $config = require $ruta;
        break;
    }
}

if (!is_array($config)) {
    fallar(500, 'no se encontro config-retencion.php en ninguna ruta candidata');
}

try {
    $bd = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['base']),
        $config['usuario'],
        $config['clave'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $e) {
    fallar(500, 'conexion fallida: ' . $e->getMessage());
}

// ── Límite por IP ─────────────────────────────────────────────────────
// La IP se usa solo para limitar y NUNCA se guarda en claro: se guarda un
// hash con el salt del config, que no es reversible y no sirve para
// reidentificar a nadie.

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ipHash = hash('sha256', $ip . ($config['salt'] ?? ''));
$ventana = (int) floor(time() / VENTANA_LIMITE_SEG);

try {
    $sent = $bd->prepare(
        'INSERT INTO retencion_limite (ip_hash, ventana, golpes)
         VALUES (:h, :v, 1)
         ON DUPLICATE KEY UPDATE golpes = golpes + 1'
    );
    $sent->execute([':h' => $ipHash, ':v' => $ventana]);

    $sent = $bd->prepare('SELECT golpes FROM retencion_limite WHERE ip_hash = :h AND ventana = :v');
    $sent->execute([':h' => $ipHash, ':v' => $ventana]);
    if ((int) $sent->fetchColumn() > LIMITE_PETICIONES) {
        salir(429, 'demasiadas_peticiones');
    }
} catch (Throwable $e) {
    // Un fallo del limitador no debe tirar la medición entera; se anota y se
    // sigue. Perder el límite un rato es menos malo que perder los datos.
    error_log('[retencion] limitador: ' . $e->getMessage());
}

// ── Cuerpo ────────────────────────────────────────────────────────────

$crudo = file_get_contents('php://input');
if ($crudo === false || $crudo === '' || strlen($crudo) > MAX_CUERPO_BYTES) {
    salir(400, 'cuerpo_invalido');
}

$datos = json_decode($crudo, true);
if (!is_array($datos)) {
    salir(400, 'json_invalido');
}

// sid: exactamente el formato que genera crypto.randomUUID(), o el respaldo
// "efimero-xxxxxxxx" de cuando sessionStorage está bloqueado.
$sid = (string) ($datos['sid'] ?? '');
if (!preg_match('/^[a-f0-9-]{36}$/i', $sid) && !preg_match('/^efimero-[a-f0-9]{1,16}$/i', $sid)) {
    salir(400, 'sid_invalido');
}

$limpiarUtm = static function ($valor): string {
    if (!is_string($valor)) {
        return '';
    }
    // Lista blanca de caracteres: lo que de verdad aparece en un utm.
    return substr(preg_replace('/[^A-Za-z0-9_\-\.]/', '', $valor) ?? '', 0, 64);
};

$utmSource = $limpiarUtm($datos['utm_source'] ?? '');
$utmCampaign = $limpiarUtm($datos['utm_campaign'] ?? '');

$hitos = $datos['hitos'] ?? null;
if (!is_array($hitos) || $hitos === [] || count($hitos) > MAX_HITOS_POR_LOTE) {
    salir(400, 'hitos_invalidos');
}

// ── Inserción ─────────────────────────────────────────────────────────
// INSERT IGNORE contra la clave única (sid, evento, hito_pct): si un beacon se
// reenvía —cosa que el navegador puede hacer— el hito no se cuenta dos veces.
// Sin esto la curva de retención se deforma sola.

try {
    $sent = $bd->prepare(
        'INSERT IGNORE INTO retencion_video
            (sid, evento, hito_pct, segundo, utm_source, utm_campaign, creado_en)
         VALUES (:sid, :evento, :hito, :segundo, :fuente, :campana, UTC_TIMESTAMP())'
    );

    // Se cuenta lo realmente insertado, no lo recibido: un lote puede traer
    // hitos que ya estaban (el UNIQUE los descarta) o mal formados (se
    // saltan). Sin este número, un cliente que manda basura recibiría el
    // mismo "ok" que uno correcto y no habría forma de notarlo desde fuera.
    $guardados = 0;
    foreach ($hitos as $hito) {
        if (!is_array($hito)) {
            continue;
        }

        $evento = (string) ($hito['evento'] ?? '');
        if (!in_array($evento, EVENTOS_VALIDOS, true)) {
            continue;
        }

        $pct = filter_var($hito['hito_pct'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 0, 'max_range' => 100],
        ]);
        if ($pct === false || $pct === null) {
            continue;
        }

        $segundo = filter_var($hito['segundo'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 0, 'max_range' => 86400],
        ]);
        if ($segundo === false || $segundo === null) {
            continue;
        }

        $sent->execute([
            ':sid' => $sid,
            ':evento' => $evento,
            ':hito' => $pct,
            ':segundo' => $segundo,
            ':fuente' => $utmSource,
            ':campana' => $utmCampaign,
        ]);
        $guardados++;
    }
} catch (Throwable $e) {
    fallar(500, 'insercion fallida: ' . $e->getMessage());
}

salir(200, 'ok', $guardados);
