<?php

/**
 * Panel de retención del VSL.
 *
 * Página privada: curva de retención, embudo y caídas. Se renderiza entera en
 * PHP con barras de CSS — sin librería de gráficos y sin CDN, que es la regla
 * de cero terceros del proyecto (y de paso evita el SRI de un script externo).
 *
 * Acceso: HTTP Basic contra el hash del config, que vive fuera del docroot.
 * Además va con noindex y bloqueado en robots.txt.
 */

declare(strict_types=1);

// Se busca subiendo carpeta a carpeta y no con rutas fijas: con rutas fijas
// esto se rompió al mover la landing de public_html/ a public_html/clase/,
// porque apareció un nivel más de profundidad. Ver el mismo comentario en
// api/retencion.php.
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
    http_response_code(500);
    error_log('[panel-retencion] no se encontro config-retencion.php');
    exit('Error de configuración.');
}

// ── Autenticación ─────────────────────────────────────────────────────

$usuario = $_SERVER['PHP_AUTH_USER'] ?? '';
$clave = $_SERVER['PHP_AUTH_PW'] ?? '';

// hash_equals en el usuario para no filtrar por tiempo si es correcto o no;
// password_verify ya es constante en el tiempo para la clave.
$usuarioOk = hash_equals((string) ($config['panel_usuario'] ?? ''), $usuario);
$claveOk = password_verify($clave, (string) ($config['panel_hash'] ?? ''));

if (!$usuarioOk || !$claveOk) {
    header('WWW-Authenticate: Basic realm="Panel de retencion"');
    http_response_code(401);
    exit('Acceso restringido.');
}

header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: text/html; charset=utf-8');

// ── Conexión ──────────────────────────────────────────────────────────

try {
    $bd = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['base']),
        $config['usuario'],
        $config['clave'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[panel-retencion] conexion: ' . $e->getMessage());
    exit('Error de conexión.');
}

// ── Filtros ───────────────────────────────────────────────────────────

$hoy = new DateTimeImmutable('now', new DateTimeZone('UTC'));

function fechaValida(?string $valor, string $porDefecto): string
{
    if (is_string($valor) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
        return $valor;
    }
    return $porDefecto;
}

$desde = fechaValida($_GET['desde'] ?? null, $hoy->modify('-30 days')->format('Y-m-d'));
$hasta = fechaValida($_GET['hasta'] ?? null, $hoy->format('Y-m-d'));
$campana = substr(preg_replace('/[^A-Za-z0-9_\-\.]/', '', (string) ($_GET['campana'] ?? '')) ?? '', 0, 64);

$where = 'creado_en >= :desde AND creado_en < DATE_ADD(:hasta, INTERVAL 1 DAY)';
$params = [':desde' => $desde, ':hasta' => $hasta];
if ($campana !== '') {
    $where .= ' AND utm_campaign = :campana';
    $params[':campana'] = $campana;
}

// ── Consultas ─────────────────────────────────────────────────────────

/** Sesiones distintas por evento — la base de todos los porcentajes. */
function sesionesPorEvento(PDO $bd, string $where, array $params, string $evento): int
{
    $sent = $bd->prepare("SELECT COUNT(DISTINCT sid) FROM retencion_video WHERE $where AND evento = :evento");
    $sent->execute($params + [':evento' => $evento]);
    return (int) $sent->fetchColumn();
}

$sesiones = sesionesPorEvento($bd, $where, $params, 'inicio');
$llegaronAlPitch = sesionesPorEvento($bd, $where, $params, 'pitch');
$hicieronClic = sesionesPorEvento($bd, $where, $params, 'clic_cta');
$terminaron = sesionesPorEvento($bd, $where, $params, 'fin');

// Cuántas sesiones distintas alcanzaron cada hito de progreso.
$sent = $bd->prepare(
    "SELECT hito_pct, COUNT(DISTINCT sid) AS sesiones
     FROM retencion_video
     WHERE $where AND evento = 'progreso'
     GROUP BY hito_pct
     ORDER BY hito_pct"
);
$sent->execute($params);
$porHito = [];
foreach ($sent->fetchAll(PDO::FETCH_ASSOC) as $fila) {
    $porHito[(int) $fila['hito_pct']] = (int) $fila['sesiones'];
}

// Segundo mediano en que se alcanza cada hito: convierte el % en un minuto
// concreto del video, que es como se mira en la práctica ("me caen en el 7:30").
$sent = $bd->prepare(
    "SELECT hito_pct, AVG(segundo) AS segundo
     FROM retencion_video
     WHERE $where AND evento = 'progreso'
     GROUP BY hito_pct"
);
$sent->execute($params);
$segundoDeHito = [];
foreach ($sent->fetchAll(PDO::FETCH_ASSOC) as $fila) {
    $segundoDeHito[(int) $fila['hito_pct']] = (int) round((float) $fila['segundo']);
}

// Lista de campañas para el filtro.
$sent = $bd->query("SELECT DISTINCT utm_campaign FROM retencion_video WHERE utm_campaign <> '' ORDER BY utm_campaign");
$campanas = $sent->fetchAll(PDO::FETCH_COLUMN) ?: [];

// ── Curva y mayor caída ───────────────────────────────────────────────

$curva = [];
$anterior = $sesiones;
$mayorCaida = ['desde' => 0, 'hasta' => 0, 'puntos' => 0.0];

for ($pct = 5; $pct <= 100; $pct += 5) {
    $enEsteHito = $porHito[$pct] ?? 0;
    $pctRetenido = $sesiones > 0 ? ($enEsteHito / $sesiones) * 100 : 0.0;
    $pctAnterior = $sesiones > 0 ? ($anterior / $sesiones) * 100 : 0.0;
    $caida = $pctAnterior - $pctRetenido;

    if ($caida > $mayorCaida['puntos']) {
        $mayorCaida = ['desde' => $pct - 5, 'hasta' => $pct, 'puntos' => $caida];
    }

    $curva[] = [
        'pct' => $pct,
        'sesiones' => $enEsteHito,
        'retenido' => $pctRetenido,
        'caida' => $caida,
        'segundo' => $segundoDeHito[$pct] ?? null,
    ];
    $anterior = $enEsteHito;
}

function e(?string $valor): string
{
    return htmlspecialchars((string) $valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function reloj(?int $segundos): string
{
    if ($segundos === null) {
        return '—';
    }
    return sprintf('%d:%02d', intdiv($segundos, 60), $segundos % 60);
}

function porcentaje(int $parte, int $total): string
{
    return $total > 0 ? number_format(($parte / $total) * 100, 1) . '%' : '—';
}

?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Retención del VSL · Plan de Edición Total</title>
<style>
  :root {
    --fondo: #090807;
    --superficie: #141210;
    --linea: #3a3128;
    --texto: #f5f1ea;
    --suave: #b8ab9c;
    --primario: #ff6a00;
    --aviso: #fbbf24;
    --exito: #4ade80;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 16px 64px;
    background: var(--fondo);
    color: var(--texto);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .envoltorio { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .sub { color: var(--suave); font-size: 0.85rem; margin: 0 0 24px; }

  form { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 24px; }
  label { display: block; font-size: 0.75rem; color: var(--suave); margin-bottom: 4px; }
  input, select, button {
    font: inherit;
    padding: 6px 10px;
    background: var(--superficie);
    color: var(--texto);
    border: 1px solid var(--linea);
    border-radius: 2px;
  }
  button { background: var(--primario); color: #fff; border-color: var(--primario); cursor: pointer; }

  .tarjetas { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); margin-bottom: 32px; }
  @media (min-width: 768px) { .tarjetas { grid-template-columns: repeat(4, 1fr); } }
  .tarjeta { background: var(--superficie); border: 1px solid var(--linea); border-radius: 4px; padding: 14px; }
  .tarjeta .cifra { font-size: 1.6rem; font-weight: 600; line-height: 1.1; }
  .tarjeta .rotulo { font-size: 0.75rem; color: var(--suave); margin-top: 4px; }

  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--linea); }
  th:first-child, td:first-child { text-align: left; }
  th { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--suave); font-weight: 600; }
  .barra { position: relative; height: 18px; background: rgb(255 255 255 / 0.06); border-radius: 2px; min-width: 120px; }
  .barra span { display: block; height: 100%; background: var(--primario); border-radius: 2px; }
  td.barra-celda { width: 45%; }
  .caida-fuerte { color: var(--aviso); font-weight: 600; }
  .vacio { padding: 32px; text-align: center; color: var(--suave); background: var(--superficie); border: 1px solid var(--linea); border-radius: 4px; }
  .nota { margin-top: 24px; font-size: 0.8rem; color: var(--suave); }
</style>
</head>
<body>
<div class="envoltorio">

  <h1>Retención del VSL</h1>
  <p class="sub">Masterclass pregrabada · Plan de Edición Total</p>

  <form method="get">
    <div>
      <label for="desde">Desde</label>
      <input type="date" id="desde" name="desde" value="<?= e($desde) ?>">
    </div>
    <div>
      <label for="hasta">Hasta</label>
      <input type="date" id="hasta" name="hasta" value="<?= e($hasta) ?>">
    </div>
    <div>
      <label for="campana">Campaña</label>
      <select id="campana" name="campana">
        <option value="">Todas</option>
        <?php foreach ($campanas as $nombre): ?>
          <option value="<?= e($nombre) ?>"<?= $nombre === $campana ? ' selected' : '' ?>><?= e($nombre) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <button type="submit">Filtrar</button>
  </form>

  <div class="tarjetas">
    <div class="tarjeta">
      <div class="cifra"><?= number_format($sesiones) ?></div>
      <div class="rotulo">Le dieron play</div>
    </div>
    <div class="tarjeta">
      <div class="cifra"><?= porcentaje($llegaronAlPitch, $sesiones) ?></div>
      <div class="rotulo">Llegaron al pitch (<?= number_format($llegaronAlPitch) ?>)</div>
    </div>
    <div class="tarjeta">
      <div class="cifra"><?= porcentaje($hicieronClic, $sesiones) ?></div>
      <div class="rotulo">Clic en comprar (<?= number_format($hicieronClic) ?>)</div>
    </div>
    <div class="tarjeta">
      <div class="cifra"><?= porcentaje($terminaron, $sesiones) ?></div>
      <div class="rotulo">Vieron el video entero (<?= number_format($terminaron) ?>)</div>
    </div>
  </div>

  <?php if ($sesiones === 0): ?>
    <p class="vacio">Todavía no hay reproducciones en este rango de fechas.</p>
  <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>Punto del video</th>
          <th>Minuto</th>
          <th>Sesiones</th>
          <th>Retención</th>
          <th class="barra-celda"></th>
          <th>Caída</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($curva as $punto): ?>
          <tr>
            <td><?= (int) $punto['pct'] ?>%</td>
            <td><?= e(reloj($punto['segundo'])) ?></td>
            <td><?= number_format($punto['sesiones']) ?></td>
            <td><?= number_format($punto['retenido'], 1) ?>%</td>
            <td class="barra-celda">
              <div class="barra"><span style="width: <?= number_format($punto['retenido'], 2) ?>%"></span></div>
            </td>
            <td class="<?= $punto['caida'] >= 10 ? 'caida-fuerte' : '' ?>">
              <?= $punto['caida'] > 0 ? '−' . number_format($punto['caida'], 1) : '—' ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>

    <?php if ($mayorCaida['puntos'] > 0): ?>
      <p class="nota">
        <strong>Mayor caída:</strong> entre el <?= (int) $mayorCaida['desde'] ?>% y el
        <?= (int) $mayorCaida['hasta'] ?>% del video se van
        <?= number_format($mayorCaida['puntos'], 1) ?> puntos de audiencia.
        Es el primer tramo que vale la pena volver a editar.
      </p>
    <?php endif; ?>
  <?php endif; ?>

  <p class="nota">
    Sin cookies y sin datos personales: no se guarda IP ni user-agent. El identificador de sesión
    muere al cerrar la pestaña, así que estas cifras cuentan reproducciones, no personas.
  </p>

</div>
</body>
</html>
