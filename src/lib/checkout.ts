/**
 * Checkout de Hotmart en popup, centralizado.
 *
 * El fragmento que da Hotmart engancha su widget a cualquier enlace con las
 * clases `hotmart-fb hotmart__button-checkout` y le abre el checkout en una
 * ventana modal (`checkoutMode=2`). Acá se usa ese mismo mecanismo, pero
 * sobre los botones propios: se conservan los estilos de la página y solo se
 * toma el comportamiento.
 *
 * Tres cosas que este archivo resuelve y que el fragmento suelto no:
 *
 * 1. UN SOLO EVENTO PARA EL PIXEL, dispare el botón que dispare.
 *    Hay varios botones de compra en la página (bajo el video, en la franja
 *    flotante, y en la pantalla final). Sin esto, alguien que pulsa dos de
 *    ellos cuenta como dos conversiones y el coste por conversión de la
 *    campaña sale mal. Ver `disparado` más abajo: el evento sale una vez por
 *    sesión, con un `eventID` estable — que es además lo que le permite a
 *    Meta deduplicar si algún día se añade la Conversions API por servidor.
 *
 * 2. EL WIDGET SE CARGA BAJO DEMANDA, no al abrir la página.
 *    Son dos peticiones a static.hotmart.com (script + hoja de estilos) que
 *    no hacen ninguna falta hasta que la oferta está a la vista. Cargarlas
 *    al entrar penaliza el arranque de la página, que es justo donde se
 *    juega que el visitante se quede a ver la clase.
 *
 * 3. FALLBACK REAL SI EL WIDGET NO CARGA.
 *    Los enlaces llevan su `href` de verdad al checkout de Hotmart. Si el
 *    script de terceros falla, está bloqueado, o el visitante pulsa antes de
 *    que termine de cargar, el clic navega al checkout en una pestaña nueva
 *    en vez de no hacer nada. El fragmento original usa
 *    `onclick="return false;"`, que en ese caso deja el botón muerto.
 */

import { ENLACE_OFERTA, ENLACE_REGULAR } from '../datos/oferta';

const CLAVE_EVENTO = 'pet-checkout-evento';

/** Las clases con las que el widget de Hotmart reconoce un botón suyo. */
const CLASES_HOTMART = ['hotmart-fb', 'hotmart__button-checkout'];

let cargado = false;

/**
 * Inyecta el script y la hoja de estilos del widget. Idempotente: se puede
 * llamar tantas veces como haga falta.
 *
 * Sin `integrity`: Hotmart publica estos archivos sin versionar y los
 * actualiza en caliente, así que un hash fijo rompería el checkout el día
 * que los cambien. Es la excepción consciente a la regla de SRI del
 * proyecto, y por eso mismo el enlace conserva su href real como respaldo.
 */
function cargarWidget(): void {
  if (cargado) return;
  cargado = true;

  const script = document.createElement('script');
  script.src = 'https://static.hotmart.com/checkout/widget.min.js';
  script.async = true;
  document.head.appendChild(script);

  const estilos = document.createElement('link');
  estilos.rel = 'stylesheet';
  estilos.href = 'https://static.hotmart.com/css/hotmart-fb.min.css';
  document.head.appendChild(estilos);
}

/**
 * Identificador del evento de conversión. Uno por sesión: si el visitante
 * pulsa dos botones distintos, los dos llevan el mismo id y valen como un
 * solo intento de compra.
 */
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

/**
 * Emite la conversión una sola vez por sesión. La escuchan lib/tracking.ts
 * (que la reenvía al Pixel de Meta y a GA4 cuando hay consentimiento) y
 * lib/retencion.ts (que la cruza contra la curva del video).
 */
function emitirConversion(): void {
  if (disparado) return;
  disparado = true;

  document.dispatchEvent(
    new CustomEvent('conversion', {
      detail: { tipo: 'clic_comprar', evento_id: idEvento() },
    }),
  );
}

export function iniciarCheckout(): void {
  const botones = document.querySelectorAll<HTMLAnchorElement>('[data-cta-compra]');
  if (botones.length === 0) return;

  botones.forEach((boton) => {
    // Las clases del widget se ponen desde acá y no en el HTML: así el
    // marcado no depende de un detalle de implementación de Hotmart, y si
    // algún día cambia el nombre de la clase se toca un solo sitio.
    boton.classList.add(...CLASES_HOTMART);

    boton.addEventListener('click', () => {
      emitirConversion();
      // El widget ya se encarga de abrir el popup y de cancelar la
      // navegación. Si no llegó a cargar, el href hace su trabajo y el
      // visitante acaba igualmente en el checkout.
      cargarWidget();
    });
  });

  // El widget se precarga al desplegarse la oferta, no al entrar: para
  // cuando el visitante llegue a pulsar, ya está listo y el popup abre al
  // instante en vez de tras una espera.
  document.addEventListener('pitch-desbloqueado', cargarWidget, { once: true });
}

/** Los dos destinos, para que oferta.ts los use sin duplicar las constantes. */
export { ENLACE_OFERTA, ENLACE_REGULAR };
