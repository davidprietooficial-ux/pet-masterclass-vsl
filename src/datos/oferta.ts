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
 * `checkoutMode=2` es lo que hace que el widget abra el checkout en una
 * ventana modal encima de la página en vez de navegar fuera. Es el modo del
 * fragmento que pasó el cliente, y el que usa lib/checkout.ts.
 *
 * `off=` es el código de la oferta. El de abajo (1oaqxr4m) es el promocional
 * que incluye el bono de IA, y es el que se muestra durante las 24h.
 */
const PRODUCTO = 'D100998112T';

export const ENLACE_OFERTA = `https://pay.hotmart.com/${PRODUCTO}?checkoutMode=2&off=1oaqxr4m`;

/**
 * PENDIENTE DE CONFIRMAR: el cliente solo pasó el enlace de la oferta. Este
 * es el mismo producto sin el código promocional, que es lo que Hotmart
 * sirve por defecto — pero si el precio regular tiene su propia oferta
 * configurada, hay que poner ese `off=` aquí.
 */
export const ENLACE_REGULAR = `https://pay.hotmart.com/${PRODUCTO}?checkoutMode=2`;

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
