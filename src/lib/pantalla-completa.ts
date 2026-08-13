/**
 * Pantalla completa del reproductor.
 *
 * El botón pide pantalla completa sobre el CONTENEDOR `.vsl`, no sobre el
 * `<video>`. Es la decisión que sostiene todo lo demás: pedirlo sobre el
 * video hace que el navegador imponga sus controles nativos —barra de
 * progreso incluida— y entonces el anti-scrub pasa de ser invisible a ser
 * una pelea a la vista del usuario, que arrastra y ve cómo el video vuelve
 * solo. Sobre el contenedor, a pantalla completa se ve esta misma interfaz:
 * el botón de play, el volumen, y ninguna barra que arrastrar.
 *
 * La excepción es el iPhone. Safari en iOS no pone en pantalla completa
 * ningún elemento que no sea un `<video>`, así que ahí se usa su API propia
 * (`webkitEnterFullscreen`) y sí aparecen los controles nativos. El
 * anti-scrub de `reproductor.ts` sigue revirtiendo los saltos por su cuenta,
 * de modo que el contenido queda igual de protegido — solo que la barra se
 * ve. Es el único sitio donde no se puede evitar.
 *
 * Los cuatro estados no aplican aquí: no hay petición de red ni espera. Lo
 * que sí se cubre es el fallo — si el navegador rechaza la petición (pasa
 * cuando no viene de un gesto real del usuario), el botón se queda como
 * estaba y no se anuncia un modo que no llegó a activarse.
 */

/** Safari y iOS todavía exponen esto con prefijo. */
interface ElementoConPrefijos extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface VideoIOS extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
}

interface DocumentoConPrefijos extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function elementoActual(): Element | null {
  const doc = document as DocumentoConPrefijos;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function iniciarPantallaCompleta(): void {
  const contenedor = document.querySelector<HTMLElement>('[data-vsl]');
  const boton = document.querySelector<HTMLButtonElement>('[data-vsl-expandir]');
  if (!contenedor || !boton) return;

  const video = contenedor.querySelector<VideoIOS>('[data-vsl-video]');
  if (!video) return;

  const iconoAbrir = boton.querySelector<SVGElement>('[data-vsl-expandir-icono="abrir"]');
  const iconoCerrar = boton.querySelector<SVGElement>('[data-vsl-expandir-icono="cerrar"]');

  // Si el navegador no sabe hacer nada de esto, el botón sobra: mejor que no
  // exista a que exista y no responda.
  const soportaContenedor =
    typeof contenedor.requestFullscreen === 'function' ||
    typeof (contenedor as ElementoConPrefijos).webkitRequestFullscreen === 'function';
  const soportaVideoIOS = typeof video.webkitEnterFullscreen === 'function';

  if (!soportaContenedor && !soportaVideoIOS) {
    boton.hidden = true;
    return;
  }

  function pintar(): void {
    const dentro = elementoActual() === contenedor;
    contenedor!.classList.toggle('vsl--completa', dentro);
    if (iconoAbrir) iconoAbrir.style.display = dentro ? 'none' : '';
    if (iconoCerrar) iconoCerrar.style.display = dentro ? '' : 'none';
    boton!.setAttribute(
      'aria-label',
      dentro ? 'Salir de pantalla completa' : 'Ver a pantalla completa',
    );
  }

  async function alternar(): Promise<void> {
    const doc = document as DocumentoConPrefijos;

    if (elementoActual()) {
      try {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } catch {
        /* ya fuera, o el navegador se negó: no hay nada que deshacer */
      }
      return;
    }

    // iPhone: solo el <video> puede ir a pantalla completa.
    if (!soportaContenedor && soportaVideoIOS) {
      video!.webkitEnterFullscreen!();
      return;
    }

    try {
      const pedir =
        contenedor!.requestFullscreen ??
        (contenedor as ElementoConPrefijos).webkitRequestFullscreen;
      await pedir!.call(contenedor);
    } catch {
      // Rechazo típico cuando la llamada no cuelga de un gesto real. No se
      // avisa de nada: el usuario ve que no pasó y vuelve a pulsar.
    }
  }

  boton.addEventListener('click', alternar);
  document.addEventListener('fullscreenchange', pintar);
  document.addEventListener('webkitfullscreenchange', pintar);
  pintar();
}
