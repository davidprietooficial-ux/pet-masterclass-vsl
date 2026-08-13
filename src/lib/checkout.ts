/**
 * Checkout de Hotmart, precargado y en un modal propio.
 *
 * POR QUÉ NO SE USA EL WIDGET DE HOTMART
 *
 * El fragmento que da Hotmart carga `widget.min.js`, que a su vez se trae
 * jQuery y fancybox y recién entonces monta el modal. Medido: entre que se
 * pide el widget y el checkout está utilizable pasan ~1.7s, y si el
 * visitante pulsa dentro de esa ventana se queda esperando. Además su hoja
 * de estilos pisaba el botón y lo volvía verde, lo que obligaba a un
 * blindaje a base de `!important`.
 *
 * En su lugar, `checkoutMode=10` —que es el modo embebido— se carga en un
 * iframe oculto en cuanto la compra pasa a ser posible, y al pulsar solo se
 * hace visible algo que ya está renderizado. El resultado es que el
 * checkout aparece al instante, sin descargar nada en ese momento.
 *
 * Y como el modal es nuestro: se ve como el resto del sitio, se cierra con
 * Escape y con clic fuera, y devuelve el foco donde estaba.
 *
 * Lo demás que resuelve este archivo:
 *
 *  · UN SOLO EVENTO PARA EL PIXEL, dispare el botón que dispare. Hay varios
 *    botones de compra; sin esto, quien pulsa dos cuenta como dos
 *    conversiones y el coste por conversión de la campaña sale mal. Se emite
 *    una vez por sesión con un `eventID` estable, que además permite
 *    deduplicar contra la Conversions API si se añade por servidor.
 *
 *  · FALLBACK REAL. Si el iframe no llega a cargar (bloqueador, red caída),
 *    el clic deja pasar el `href` y el visitante acaba en el checkout de
 *    Hotmart en una pestaña nueva. Nunca se queda con un botón muerto.
 */

import { ENLACE_OFERTA, ENLACE_REGULAR } from '../datos/oferta';
import { pitchYaDesbloqueado } from './pitch';

const CLAVE_EVENTO = 'pet-checkout-evento';

let modal: HTMLElement | null = null;
let marco: HTMLIFrameElement | null = null;
let cargado = false;
let urlCargada = '';
let devolverFocoA: HTMLElement | null = null;

// ── El modal ──────────────────────────────────────────────────────────

function construirModal(): void {
  if (modal) return;

  modal = document.createElement('div');
  modal.className = 'checkout';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Finalizar compra');

  const caja = document.createElement('div');
  caja.className = 'checkout__caja';

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'checkout__cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar');
  cerrar.textContent = '✕';
  cerrar.addEventListener('click', ocultarCheckout);

  marco = document.createElement('iframe');
  marco.className = 'checkout__marco';
  marco.title = 'Checkout de Hotmart';
  // allow="payment": sin esto, algunos métodos de pago del checkout no
  // pueden operar dentro de un iframe.
  marco.setAttribute('allow', 'payment');
  marco.setAttribute('loading', 'eager');

  caja.append(cerrar, marco);
  modal.append(caja);

  // Clic en el velo (fuera de la caja) cierra. Dentro, no.
  modal.addEventListener('click', (evento) => {
    if (evento.target === modal) ocultarCheckout();
  });

  document.body.append(modal);
}

/**
 * Carga el checkout en el iframe oculto. Se llama mucho antes de que el
 * visitante pulse, así que para entonces ya está renderizado.
 *
 * Se recarga solo si el destino cambió: el corte de 24h puede cambiar el
 * enlace mientras el visitante sigue en la página, y sería un error grave
 * mostrarle el checkout de la oferta cuando ya venció (o al revés).
 */
function precargarCheckout(): void {
  construirModal();
  if (!marco) return;

  const destino = destinoActual();
  if (urlCargada === destino) return;

  urlCargada = destino;
  cargado = false;
  marco.addEventListener('load', () => (cargado = true), { once: true });
  marco.src = destino;
}

/** El enlace que corresponde ahora mismo, según el estado de la oferta. */
function destinoActual(): string {
  const boton = document.querySelector<HTMLAnchorElement>('[data-cta-compra]');
  return boton?.href || ENLACE_OFERTA;
}

function mostrarCheckout(): void {
  if (!modal) return;
  devolverFocoA = document.activeElement as HTMLElement | null;

  modal.hidden = false;
  document.body.classList.add('con-checkout-abierto');

  const cerrar = modal.querySelector<HTMLButtonElement>('.checkout__cerrar');
  cerrar?.focus();

  document.addEventListener('keydown', alPulsarTecla);
}

function ocultarCheckout(): void {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('con-checkout-abierto');
  document.removeEventListener('keydown', alPulsarTecla);
  devolverFocoA?.focus();
}

function alPulsarTecla(evento: KeyboardEvent): void {
  if (evento.key === 'Escape') ocultarCheckout();
}

// ── Conversión ────────────────────────────────────────────────────────

function idEvento(): string {
  try {
    const guardado = window.sessionStorage.getItem(CLAVE_EVENTO);
    if (guardado) return guardado;
    const nuevo =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cta-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;
    window.sessionStorage.setItem(CLAVE_EVENTO, nuevo);
    return nuevo;
  } catch {
    return `cta-${Date.now().toString(16)}`;
  }
}

let disparado = false;

function emitirConversion(): void {
  if (disparado) return;
  disparado = true;

  document.dispatchEvent(
    new CustomEvent('conversion', {
      detail: { tipo: 'clic_comprar', evento_id: idEvento() },
    }),
  );
}

// ── Arranque ──────────────────────────────────────────────────────────

export function iniciarCheckout(): void {
  const botones = document.querySelectorAll<HTMLAnchorElement>('[data-cta-compra]');
  if (botones.length === 0) return;

  botones.forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      emitirConversion();

      // Si el iframe no llegó a cargar, no se secuestra el clic: que el
      // `href` haga su trabajo y el visitante acabe en el checkout de
      // Hotmart, aunque sea en otra pestaña. Un botón que no hace nada
      // sería mucho peor.
      if (!cargado || !modal) return;

      evento.preventDefault();
      mostrarCheckout();
    });
  });

  // El checkout se precarga en cuanto la compra pasa a ser posible: al
  // darle play al video (el visitante va a estar minutos viendo la clase,
  // tiempo de sobra) o al desplegarse la oferta. Nunca al abrir la página,
  // que es donde se juega que se quede a ver.
  document.addEventListener('vsl-arrancado', precargarCheckout, { once: true });
  document.addEventListener('pitch-desbloqueado', precargarCheckout);
  if (pitchYaDesbloqueado()) precargarCheckout();

  // El corte de 24h puede cambiar el destino con el visitante todavía en la
  // página. Se vigila el href del botón, que es donde lib/oferta.ts escribe
  // el estado, y se recarga el iframe si cambió.
  const observador = new MutationObserver(() => {
    if (urlCargada && urlCargada !== destinoActual()) precargarCheckout();
  });
  botones.forEach((b) => observador.observe(b, { attributes: true, attributeFilter: ['href'] }));
}

/** Los dos destinos, para que oferta.ts los use sin duplicar las constantes. */
export { ENLACE_OFERTA, ENLACE_REGULAR };
