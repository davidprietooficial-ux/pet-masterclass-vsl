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
 * 3. EL POPUP ABRE YA EN EL PRIMER CLIC.
 *    El widget se precarga en cuanto la oferta está a la vista. Y si aun así
 *    alguien pulsa antes de que termine de cargar, el clic no se va por el
 *    `href` —que abriría una pestaña nueva en vez del popup—: se frena, se
 *    espera al widget y se repite el clic ya enganchado.
 *
 * 4. FALLBACK REAL SI EL WIDGET NO CARGA.
 *    Los enlaces conservan su `href` de verdad. Si el script de terceros
 *    falla o está bloqueado, el segundo clic lleva al checkout en una
 *    pestaña nueva en vez de no hacer nada. El fragmento original usa
 *    `onclick="return false;"`, que en ese caso deja el botón muerto.
 */

import { ENLACE_OFERTA, ENLACE_REGULAR } from '../datos/oferta';
import { pitchYaDesbloqueado } from './pitch';

const CLAVE_EVENTO = 'pet-checkout-evento';

/** Las clases con las que el widget de Hotmart reconoce un botón suyo. */
const CLASES_HOTMART = ['hotmart-fb', 'hotmart__button-checkout'];

let cargado = false;
let listo = false;
const alEstarListo: Array<() => void> = [];

/**
 * Inyecta el script y la hoja de estilos del widget. Idempotente: se puede
 * llamar tantas veces como haga falta. El callback se ejecuta cuando el
 * script ya está en marcha (o de inmediato, si ya lo estaba).
 *
 * Sin `integrity`: Hotmart publica estos archivos sin versionar y los
 * actualiza en caliente, así que un hash fijo rompería el checkout el día
 * que los cambien. Es la excepción consciente a la regla de SRI del
 * proyecto, y por eso mismo el enlace conserva su href real como respaldo.
 */
function cargarWidget(despues?: () => void): void {
  if (listo) {
    despues?.();
    return;
  }
  if (despues) alEstarListo.push(despues);
  if (cargado) return;
  cargado = true;

  const estilos = document.createElement('link');
  estilos.rel = 'stylesheet';
  estilos.href = 'https://static.hotmart.com/css/hotmart-fb.min.css';
  document.head.appendChild(estilos);

  const script = document.createElement('script');
  script.src = 'https://static.hotmart.com/checkout/widget.min.js';
  script.async = true;
  script.addEventListener('load', () => {
    listo = true;
    // Un fotograma de margen: el widget engancha los botones al cargar, y
    // hay que dejarle terminar antes de reintentar el clic.
    requestAnimationFrame(() => {
      alEstarListo.splice(0).forEach((fn) => fn());
    });
  });
  script.addEventListener('error', () => {
    // Si no carga, los enlaces siguen teniendo su href real: el siguiente
    // clic lleva al checkout en una pestaña nueva en vez de no hacer nada.
    listo = false;
    alEstarListo.length = 0;
  });
  document.head.appendChild(script);
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

    let reintentado = false;

    boton.addEventListener('click', (evento) => {
      emitirConversion();

      // Widget ya cargado: él intercepta el clic y abre el popup. Acá no
      // hay nada que hacer.
      if (listo) return;

      // Todavía no. Sin esto, el primer clic se iba por el `href` y abría
      // el checkout en una pestaña nueva en vez del popup — que es
      // exactamente lo que no se quiere. Se frena la navegación, se carga
      // el widget y se repite el clic cuando ya está enganchado.
      if (reintentado) return; // el widget falló: que el href haga su trabajo
      evento.preventDefault();
      reintentado = true;

      cargarWidget(() => boton.click());
    });
  });

  // El widget se precarga en cuanto la oferta está a la vista, no al entrar
  // en la página: así, para cuando el visitante llegue a pulsar, ya está
  // listo y el popup abre al instante.
  //
  // Se comprueba el estado además de escuchar el evento: iniciarPitch() corre
  // antes que esto en main.ts, así que a quien ya venía desbloqueado de otra
  // sesión el evento se le emite antes de que exista este listener.
  if (pitchYaDesbloqueado()) cargarWidget();
  document.addEventListener('pitch-desbloqueado', () => cargarWidget(), { once: true });
}

/** Los dos destinos, para que oferta.ts los use sin duplicar las constantes. */
export { ENLACE_OFERTA, ENLACE_REGULAR };
