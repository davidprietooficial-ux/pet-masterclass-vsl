/**
 * Formulario de acceso a la clase.
 *
 * Rellenarlo es requisito para ver el video: hasta que no se envía, el
 * reproductor queda tapado. Es lo que pidió el cliente, con el contrapeso
 * anotado en PROYECTO.md.
 *
 * Quien ya se registró entra directo la próxima vez (se recuerda en su
 * navegador): volver a pedirle los datos a quien ya los dio molesta y no
 * aporta ningún lead nuevo, solo filas duplicadas en la hoja.
 *
 * Los cuatro estados que exige el contrato:
 *
 *   vacío   — el formulario tal cual, esperando datos.
 *   carga   — botón deshabilitado con "Enviando…". Sin spinner: el envío
 *             tarda menos de un segundo y un spinner corto se percibe más
 *             lento que ninguno.
 *   error   — mensaje sobre el botón, con los datos intactos para
 *             corregir. Nunca se vacía el formulario ante un error: quien
 *             ya escribió su WhatsApp no lo va a escribir dos veces.
 *   éxito   — desaparece el formulario y queda la clase lista.
 *
 * Envío con `fetch` y `no-cors` sobre Apps Script. Ese modo devuelve una
 * respuesta opaca —no se puede leer el cuerpo ni el código—, así que no hay
 * forma de saber desde el navegador si el registro llegó de verdad. Se da
 * por bueno si la petición no lanza excepción. La alternativa sería un
 * proxy PHP propio para poder leer la respuesta, pero eso mete el servidor
 * en medio de cada registro y añade un punto de fallo más para ganar solo
 * un mensaje de error más preciso. El respaldo real está en la propia hoja
 * de cálculo, que es donde se ve si un registro entró o no.
 */

import { ENDPOINT_FORMULARIO, TOKEN_FORMULARIO } from '../datos/formulario';

const CLAVE_REGISTRO = 'pet-registrado';

export function yaSeRegistro(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_REGISTRO) === '1';
  } catch {
    return false;
  }
}

function recordarRegistro(): void {
  try {
    window.localStorage.setItem(CLAVE_REGISTRO, '1');
  } catch {
    /* sin persistencia: se lo volverá a pedir en la próxima visita */
  }
}

function utm(nombre: string): string {
  return new URLSearchParams(location.search).get(nombre) ?? '';
}

export function iniciarFormulario(): void {
  const puerta = document.querySelector<HTMLElement>('[data-puerta]');
  const form = document.querySelector<HTMLFormElement>('[data-form-acceso]');
  if (!puerta || !form) return;

  // Ya registrado: no se le enseña nada. Se hace antes de cualquier otra
  // cosa para que no llegue a verse un destello del formulario.
  if (yaSeRegistro()) {
    abrirPaso(puerta);
    return;
  }

  puerta.hidden = false;
  document.documentElement.classList.add('con-puerta');

  const boton = form.querySelector<HTMLButtonElement>('[data-form-enviar]');
  const error = form.querySelector<HTMLElement>('[data-form-error]');

  // ── El botón no se habilita hasta que todo esté relleno ─────────────
  // Se apoya en checkValidity() del propio formulario, no en una lista de
  // campos escrita a mano: así, si mañana se añade o se quita un campo, la
  // condición sigue siendo correcta sin tocar esto.
  //
  // El salto solo ocurre cuando el botón ESTÁ habilitado: un botón inerte
  // que da brincos promete algo que no cumple al pulsarlo.
  const revisarCompleto = (): void => {
    if (!boton || boton.dataset.enviando === '1') return;
    boton.disabled = !form.checkValidity();
  };

  form.addEventListener('input', revisarCompleto);
  form.addEventListener('change', revisarCompleto);
  revisarCompleto();

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;

    // ── carga ──
    // aria-busy además del texto y el disabled: sin él, un lector de
    // pantalla no anuncia que está pasando algo y la persona se queda
    // esperando sin saber si el envío salió o no.
    form.setAttribute('aria-busy', 'true');
    if (boton) {
      boton.dataset.enviando = '1';
      boton.disabled = true;
      boton.dataset.textoOriginal = boton.textContent ?? '';
      boton.textContent = 'Enviando…';
    }
    if (error) error.hidden = true;
    form.dataset.estado = 'cargando';

    const datos = new FormData(form);
    datos.set('token', TOKEN_FORMULARIO);
    datos.set('utm_source', utm('utm_source'));
    datos.set('utm_campaign', utm('utm_campaign'));
    datos.set('utm_content', utm('utm_content'));

    try {
      await fetch(ENDPOINT_FORMULARIO, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(datos as unknown as Record<string, string>),
      });

      // ── éxito ──
      form.removeAttribute('aria-busy');
      recordarRegistro();
      document.dispatchEvent(
        new CustomEvent('registro-completado', {
          detail: { motivo: String(datos.get('motivo') ?? '') },
        }),
      );
      abrirPaso(puerta);
    } catch {
      // ── error ──
      form.removeAttribute('aria-busy');
      if (error) {
        error.textContent = 'No se pudo enviar. Revisa tu conexión e inténtalo otra vez.';
        error.hidden = false;
      }
      if (boton) {
        delete boton.dataset.enviando;
        boton.disabled = false;
        boton.textContent = boton.dataset.textoOriginal || 'VER LA CLASE AHORA';
      }
    }
  });
}

function abrirPaso(puerta: HTMLElement): void {
  puerta.hidden = true;
  document.documentElement.classList.remove('con-puerta');
}
