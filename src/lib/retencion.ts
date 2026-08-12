/**
 * Retención del video: qué porcentaje ve cada visitante y dónde abandona.
 *
 * Analítica de primera parte contra `/api/retencion.php`, en el mismo
 * dominio. No es una preferencia de estilo, resuelve un problema concreto:
 * la regla 6 del proyecto deja GA4 y compañía en cola hasta que el visitante
 * acepte cookies, y en tráfico frío de anuncio eso significa no medir a una
 * parte grande de la gente — justo el dato que se quiere. Esto mide al 100%
 * porque no hay nada que consentir:
 *
 *   - El identificador de sesión vive en sessionStorage y muere al cerrar la
 *     pestaña. No es un identificador persistente ni permite reconocer a
 *     nadie entre visitas.
 *   - No se envía ni se guarda IP, user-agent, ni ningún dato personal. Solo
 *     el hito del video, el segundo, y de qué campaña vino.
 *
 * Nada de esto puede romper la reproducción: todo va en try/catch y falla en
 * silencio. Si el endpoint no responde, el visitante no se entera.
 */

import {
  ENDPOINT_RETENCION,
  INTERVALO_HITOS_PCT,
  INTERVALO_ENVIO_MS,
} from '../datos/vsl';

type Evento = 'inicio' | 'progreso' | 'pitch' | 'clic_cta' | 'fin';

interface Hito {
  evento: Evento;
  hito_pct: number;
  segundo: number;
}

const CLAVE_SESION = 'pet-vsl-sid';

let cola: Hito[] = [];
let sid = '';
let utmSource = '';
let utmCampaign = '';

// ── Identificador de sesión ───────────────────────────────────────────

function idSesion(): string {
  try {
    const guardado = window.sessionStorage.getItem(CLAVE_SESION);
    if (guardado) return guardado;
    // randomUUID solo existe en contexto seguro (https o localhost); el
    // respaldo cubre http de desarrollo sin romper nada.
    const nuevo =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    window.sessionStorage.setItem(CLAVE_SESION, nuevo);
    return nuevo;
  } catch {
    // sessionStorage bloqueado: se usa un id de un solo uso. La sesión no se
    // podrá unir entre recargas, pero los hitos siguen contando.
    return `efimero-${Math.random().toString(16).slice(2, 10)}`;
  }
}

// ── Envío ─────────────────────────────────────────────────────────────

function enviar(): void {
  if (cola.length === 0) return;

  const cuerpo = JSON.stringify({
    sid,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    hitos: cola,
  });
  cola = [];

  try {
    // sendBeacon y no fetch: es el único que el navegador se compromete a
    // entregar cuando la pestaña se está cerrando, que es exactamente el
    // momento en que se registra un abandono. Un fetch normal ahí se cancela
    // y el dato más importante de todos se pierde.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT_RETENCION, new Blob([cuerpo], { type: 'application/json' }));
      return;
    }
    // Navegador sin sendBeacon: keepalive hace lo mismo con peor soporte.
    void fetch(ENDPOINT_RETENCION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* medir nunca puede romper la página */
  }
}

function registrar(evento: Evento, segundo: number, hitoPct: number): void {
  cola.push({ evento, hito_pct: hitoPct, segundo: Math.floor(segundo) });
  // Los eventos que marcan el embudo salen de inmediato: son pocos y son los
  // que se miran primero. Los de progreso pueden esperar al lote.
  if (evento !== 'progreso') enviar();
}

// ── Arranque ──────────────────────────────────────────────────────────

export function iniciarRetencion(): void {
  const video = document.querySelector<HTMLVideoElement>('[data-vsl-video]');
  if (!video) return;

  sid = idSesion();

  const params = new URLSearchParams(location.search);
  // Se recortan por si alguien manda una URL absurda; el servidor recorta
  // igual, esto solo evita mandar basura por la red.
  utmSource = (params.get('utm_source') ?? '').slice(0, 64);
  utmCampaign = (params.get('utm_campaign') ?? '').slice(0, 64);

  let ultimoHito = -1;
  let arrancado = false;

  // La previa muda que corre detrás del desenfoque no es una reproducción:
  // nadie la está viendo. Se empieza a medir con `vsl-arrancado`, que el
  // reproductor emite cuando el visitante pulsa. Medir la previa inflaría
  // las reproducciones y aplanaría la curva de retención con sesiones
  // fantasma que nunca miraron nada.
  document.addEventListener(
    'vsl-arrancado',
    () => {
      arrancado = true;
      registrar('inicio', 0, 0);
    },
    { once: true },
  );

  video.addEventListener('timeupdate', () => {
    if (!arrancado) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const pct = (video.currentTime / video.duration) * 100;
    // Se redondea hacia abajo al múltiplo del intervalo: 5, 10, 15… Cada uno
    // se registra una sola vez, y solo hacia adelante — sin esto, el vaivén
    // normal de `timeupdate` repetiría el mismo hito varias veces.
    const hito = Math.floor(pct / INTERVALO_HITOS_PCT) * INTERVALO_HITOS_PCT;
    if (hito <= ultimoHito || hito <= 0) return;

    ultimoHito = hito;
    registrar('progreso', video.currentTime, hito);
  });

  video.addEventListener('ended', () => {
    if (!arrancado) return;
    registrar('fin', video.currentTime, 100);
  });

  document.addEventListener('pitch-desbloqueado', () => {
    registrar('pitch', video.currentTime, ultimoHito > 0 ? ultimoHito : 0);
  });

  document.querySelectorAll<HTMLElement>('[data-cta-compra]').forEach((cta) => {
    cta.addEventListener('click', () => {
      registrar('clic_cta', video.currentTime, ultimoHito > 0 ? ultimoHito : 0);
    });
  });

  // El vaciado periódico cubre al que se queda viendo; el de visibilitychange
  // cubre al que se va. `hidden` y no `unload`: es el único que los
  // navegadores móviles disparan de forma fiable cuando se cambia de app o se
  // cierra la pestaña.
  window.setInterval(enviar, INTERVALO_ENVIO_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviar();
  });
  window.addEventListener('pagehide', enviar);
}
