/**
 * Config del VSL: el archivo, el momento del pitch y el endpoint de retención.
 *
 * Toda la configuración del video vive acá, no repartida por los componentes.
 */

export const VSL_ARCHIVO = '/vsl/masterclass.mp4';
export const VSL_POSTER = '/vsl/masterclass-poster.webp';

/**
 * Momento en que se despliega el botón de compra y el resto de la página.
 *
 * Dos formas de expresarlo, porque el cliente puede dar el dato de cualquiera
 * de las dos maneras y no se sabe todavía cuál va a ser:
 *
 *   SEGUNDO_PITCH — segundo exacto del video. Manda si es > 0.
 *   PCT_PITCH     — porcentaje de la duración (0-100). Se usa solo si
 *                   SEGUNDO_PITCH es 0. Útil si el video se re-edita y cambia
 *                   de duración, porque el punto relativo se mantiene.
 *
 * PLACEHOLDER: 750s = 12:30. El video todavía no está grabado — el cliente
 * pasa el minuto real y se cambia este único número.
 */
export const SEGUNDO_PITCH = 750;
export const PCT_PITCH = 0;

/**
 * Segundos de progreso a partir de los cuales vale la pena ofrecer "continuar
 * donde iba". Menos que esto y el diálogo estorba más de lo que ayuda.
 */
export const UMBRAL_RETOMAR_SEG = 5;

// ── Retención ──────────────────────────────────────────────────────────

export const ENDPOINT_RETENCION = '/api/retencion.php';

/**
 * Cada cuántos puntos porcentuales se registra un hito. 5% = 20 puntos de
 * medición por sesión: suficiente resolución para ver dónde cae la curva sin
 * inundar la tabla.
 */
export const INTERVALO_HITOS_PCT = 5;

/** Cada cuánto se vacía la cola de hitos pendientes, en ms. */
export const INTERVALO_ENVIO_MS = 15000;
