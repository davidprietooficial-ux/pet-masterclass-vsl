/**
 * Config de la oferta de 24h: enlaces de compra, precio y cómo se calcula la
 * ventana.
 *
 * A diferencia del webinar en vivo (que tenía una fecha de corte única para
 * todos), aquí la clase es pregrabada y cada visitante la ve cuando quiere —
 * así que la ventana es evergreen: arranca por visitante.
 */

/**
 * Los dos destinos de compra, en Hotmart.
 *
 * `checkoutMode=10` es el checkout embebido, y es el que el widget abre en la
 * ventana modal. Se probaron los dos modos contra el servicio real: los dos
 * abren el popup, pero el 10 queda más limpio dentro de él — sin la barra de
 * cabecera con el logo de Hotmart que trae el 2, y con el método de pago ya
 * a la vista sin tener que desplazarse.
 *
 * `off=` es el código de la oferta. 1oaqxr4m es la promocional de 24h, que
 * incluye el bono de IA.
 */
const PRODUCTO = 'D100998112T';

export const ENLACE_OFERTA = `https://pay.hotmart.com/${PRODUCTO}?off=1oaqxr4m&checkoutMode=10`;

/**
 * El de después de las 24h: otro código de oferta (`off=r4q32fqa`) y sin el
 * bono de IA incluido. El `bid` viene en el enlace que dio el cliente — es
 * el identificador de la campaña de Hotmart, y se conserva tal cual para que
 * las ventas de esta franja queden atribuidas donde él las espera.
 */
export const ENLACE_REGULAR = `https://pay.hotmart.com/${PRODUCTO}?off=r4q32fqa&checkoutMode=10&bid=1786152546409`;

export const DURACION_OFERTA_HORAS = 24;

/**
 * Cuándo empieza a correr el reloj de las 24h:
 *
 *   'desbloqueo_pitch' — al llegar al pitch del video. Es el default y el que
 *                        tiene sentido: si arrancara al abrir la página, quien
 *                        ve una clase de 60 min habría quemado una hora de su
 *                        oferta antes de enterarse de que existe.
 *   'primera_visita'   — al cargar la página por primera vez.
 *
 * Cambiar de modo es cambiar esta palabra; el resto del código no se toca.
 */
export const DISPARADOR_OFERTA: 'desbloqueo_pitch' | 'primera_visita' = 'desbloqueo_pitch';

export const PRECIO_USD = 37;
export const PRECIO_BONO_IA_USD = 27;
