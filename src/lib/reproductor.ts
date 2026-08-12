/**
 * Reproductor VSL sin controles.
 *
 * Tres estados, en este orden:
 *
 *   1. PREVIA — el video ya está corriendo, mudo y en bucle, detrás de una
 *      capa de desenfoque. Encima: "te estás perdiendo la clase en vivo" y
 *      el botón. Que se vea movimiento real detrás del vidrio es lo que
 *      sostiene la idea de que la clase ya empezó; un poster estático no lo
 *      consigue.
 *   2. VIENDO — al pulsar, se quita el desenfoque, se activa el audio y el
 *      video empieza DESDE CERO. Sin controles: no se pausa ni se adelanta.
 *   3. FINAL — al terminar, la miniatura con desenfoque encima y los dos
 *      botones (comprar y soporte por WhatsApp).
 *
 * Por qué reinicia en el paso 2 y no continúa desde donde iba la previa:
 * si alguien tarda medio minuto en pulsar, continuar le quitaría medio
 * minuto de clase — y el arranque es justo donde está el gancho. La previa
 * es ambientación, no reproducción.
 *
 * Nada de la previa cuenta como "visto": mientras dura, no se guarda
 * progreso, no se registran hitos de retención y no se desbloquea el pitch.
 * De eso se encarga el evento `vsl-arrancado`, que este archivo emite al
 * pulsar y que escuchan pitch.ts y retencion.ts. Sin esa separación, un
 * video corriendo solo en segundo plano desbloquearía la oferta sin que el
 * visitante hubiera visto nada.
 *
 * Lo heredado del patrón de la plantilla (references/reproductor-video.md):
 * anti-scrub real —el listener de `seeking` revierte cualquier salto, no
 * solo los de la barra—, retomar desde localStorage con todo el acceso en
 * try/catch, y el fail-open de `controls`, que solo se quita cuando ya hay
 * una forma propia de reproducir.
 */

import { UMBRAL_RETOMAR_SEG } from '../datos/vsl';

const CLAVE_PROGRESO = 'pet-vsl-progreso';

function leerProgresoGuardado(id: string): number | null {
  try {
    const crudo = window.localStorage.getItem(`${CLAVE_PROGRESO}:${id}`);
    if (!crudo) return null;
    const segundos = Number(crudo);
    return Number.isFinite(segundos) && segundos > 0 ? segundos : null;
  } catch {
    return null; // incógnito o localStorage bloqueado
  }
}

function guardarProgreso(id: string, segundos: number): void {
  try {
    window.localStorage.setItem(`${CLAVE_PROGRESO}:${id}`, String(Math.floor(segundos)));
  } catch {
    /* el video se sigue viendo, solo no va a poder retomar */
  }
}

function borrarProgreso(id: string): void {
  try {
    window.localStorage.removeItem(`${CLAVE_PROGRESO}:${id}`);
  } catch {
    /* nada que hacer */
  }
}

function iniciarUnReproductor(contenedor: HTMLElement): void {
  const video = contenedor.querySelector<HTMLVideoElement>('[data-vsl-video]');
  const portada = contenedor.querySelector<HTMLElement>('[data-vsl-portada]');
  const botonArrancar = contenedor.querySelector<HTMLButtonElement>('[data-vsl-arrancar]');
  if (!video || !portada || !botonArrancar) return;

  const retomar = contenedor.querySelector<HTMLElement>('[data-vsl-retomar]');
  const botonContinuar = contenedor.querySelector<HTMLButtonElement>('[data-vsl-continuar]');
  const botonReiniciar = contenedor.querySelector<HTMLButtonElement>('[data-vsl-reiniciar]');
  const final = contenedor.querySelector<HTMLElement>('[data-vsl-final]');

  const id = contenedor.dataset.vsl ?? 'vsl';
  let arrancado = false;
  let ultimoTiempoValido = 0;
  let saltoPermitido = false;
  let ultimoSegundoGuardado = -1;

  // ── 1. Previa muda ──────────────────────────────────────────────────

  function arrancarPrevia(): void {
    video!.muted = true;
    video!.loop = true; // que no llegue nunca al final estando en previa
    video!.play().catch(() => {
      // Autoplay bloqueado incluso mudo (raro, pero pasa en modos de ahorro
      // de datos): se queda el poster y el botón, que es lo que importa.
    });
  }

  // ── 2. Reproducción real ────────────────────────────────────────────

  function arrancar(desdeSegundo = 0): void {
    arrancado = true;
    portada!.hidden = true;
    contenedor.classList.remove('vsl--previa');
    contenedor.classList.add('vsl--reproduciendo');

    video!.loop = false;
    video!.muted = false;

    // El salto es nuestro, así que el anti-scrub lo tiene que dejar pasar.
    saltoPermitido = true;
    video!.currentTime = desdeSegundo;
    ultimoTiempoValido = desdeSegundo;

    video!.play().catch(() => {
      // Si el navegador rechaza el audio pese al clic, se cae a mudo antes
      // que dejar la clase sin arrancar: verla sin sonido es peor que verla,
      // pero mucho mejor que una pantalla congelada.
      video!.muted = true;
      video!.play().catch(() => {
        video!.setAttribute('controls', '');
        portada!.hidden = false;
      });
    });

    // A partir de acá sí cuenta: pitch.ts y retencion.ts empiezan a mirar.
    document.dispatchEvent(new CustomEvent('vsl-arrancado'));
  }

  botonArrancar.addEventListener('click', (evento) => {
    evento.stopPropagation();
    arrancar(0);
  });

  // ── Diálogo de retomar ──────────────────────────────────────────────

  const progresoGuardado = leerProgresoGuardado(id);
  const puedeRetomar =
    progresoGuardado !== null &&
    progresoGuardado > UMBRAL_RETOMAR_SEG &&
    retomar &&
    botonContinuar &&
    botonReiniciar;

  if (puedeRetomar) {
    // Encima de la portada: decide antes de que suene nada. El botón de
    // arrancar se esconde mientras tanto para no tener dos acciones
    // compitiendo por el mismo clic.
    retomar.hidden = false;
    botonArrancar.hidden = true;

    botonContinuar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      retomar.hidden = true;
      arrancar(progresoGuardado);
    });

    botonReiniciar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      retomar.hidden = true;
      borrarProgreso(id);
      arrancar(0);
    });
  }

  // ── Progreso y anti-scrub ───────────────────────────────────────────

  video.addEventListener('timeupdate', () => {
    if (!arrancado) return; // la previa no cuenta como visto
    ultimoTiempoValido = video.currentTime;

    const segundoActual = Math.floor(video.currentTime);
    if (segundoActual !== ultimoSegundoGuardado) {
      ultimoSegundoGuardado = segundoActual;
      guardarProgreso(id, video.currentTime);
    }
  });

  // Cualquier salto que no sea el nuestro se revierte. El margen de 0.5s
  // evita pelearse con el ajuste de fotograma del propio navegador al
  // empezar a decodificar.
  video.addEventListener('seeking', () => {
    if (saltoPermitido) {
      saltoPermitido = false;
      return;
    }
    if (!arrancado) return;
    if (Math.abs(video.currentTime - ultimoTiempoValido) > 0.5) {
      video.currentTime = ultimoTiempoValido;
    }
  });

  // Sin pausa: si algo la provoca (atajo de teclado, auriculares
  // desconectados, menú contextual) se retoma sola. La única pausa que se
  // respeta es la del final del video.
  video.addEventListener('pause', () => {
    if (video.ended) return;
    if (!arrancado) return;
    video.play().catch(() => {});
  });

  video.addEventListener('ended', () => {
    if (!arrancado) return; // en previa hay loop, no debería llegar acá
    borrarProgreso(id);
    contenedor.classList.remove('vsl--reproduciendo');
    contenedor.classList.add('vsl--terminado');
    if (final) final.hidden = false;
  });

  // El control de volumen es cosa de lib/volumen.ts — es el único control
  // del reproductor y tiene bastante estado propio (nivel, deslizador,
  // icono dinámico) como para vivir aparte.

  // Recién ahora: la portada y los listeners ya están enganchados, así que
  // ya hay una forma propia de reproducir el video.
  video.removeAttribute('controls');

  contenedor.classList.add('vsl--previa');
  arrancarPrevia();
}

export function iniciarReproductores(): void {
  document.querySelectorAll<HTMLElement>('[data-vsl]').forEach(iniciarUnReproductor);
}
