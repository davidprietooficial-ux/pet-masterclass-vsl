/**
 * Config del VSL: el archivo, el momento del pitch y el endpoint de retención.
 *
 * Toda la configuración del video vive acá, no repartida por los componentes.
 */

/**
 * La ruta del video y la del póster NO viven aquí: están en `index.html`, en
 * los atributos `<source src>` y `poster` del reproductor.
 *
 * Es deliberado. Puestas desde JavaScript, un navegador sin JS —o con el JS
 * caído— se encontraría un `<video>` sin fuente: pantalla negra en vez de
 * clase. En el HTML, el video existe aunque nada más funcione, que es el
 * mismo fail-open del resto del sitio.
 *
 * Antes había aquí dos constantes con esas rutas que no las leía nadie. Peor
 * que inútiles: invitaban a cambiar la ruta en el sitio equivocado y a creer
 * que el cambio había surtido efecto.
 *
 * ── Para cambiar dónde está alojado el video ──────────────────────────
 * Se edita `index.html` y nada más. El valor puede ser una ruta del propio
 * sitio ("/vsl/masterclass.mp4") o una URL absoluta de un CDN. Si es un CDN,
 * hay que añadir su dominio a `media-src` en la CSP del `.htaccess`, o el
 * navegador bloqueará el video sin decir por qué.
 *
 * El archivo pesa unos 220 MB, así que NO viaja en el repositorio: GitHub
 * rechaza archivos de más de 100 MB. Se sube por separado a su destino.
 */

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
 * Va en SEGUNDOS, no en formato mm:ss — es un número de JavaScript, no una
 * hora. El pitch real de la clase está en 42:30, que son 2550 segundos
 * (42 × 60 + 30). Sobre los 54:09 que dura el video, cae en el 78,5%.
 */
export const SEGUNDO_PITCH = 2550;
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
