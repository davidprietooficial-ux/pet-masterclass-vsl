/**
 * Control de volumen del VSL.
 *
 * El icono no es decorativo: dice el estado real en cada momento.
 *
 *   Sin reproducir  → bocina sola, sin ondas.
 *   Mudo            → bocina tachada.
 *   Sonando         → bocina con 1, 2 o 3 ondas según el volumen.
 *
 * Se puede subir y bajar desde aquí mismo: el botón abre un deslizador. Es
 * el único control que tiene el reproductor, y a propósito — el volumen no
 * permite saltarse nada, así que no compite con el objetivo de la página,
 * mientras que un control de audio sí hace falta para que un video que suena
 * no sea un problema de accesibilidad (WCAG 1.4.2).
 *
 * El volumen elegido se recuerda entre visitas: quien lo bajó una vez no
 * tiene que volver a bajarlo.
 */

const CLAVE_VOLUMEN = 'pet-vsl-volumen';

function leerVolumen(): number | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_VOLUMEN);
    if (crudo === null) return null;
    const v = Number(crudo);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
  } catch {
    return null;
  }
}

function guardarVolumen(v: number): void {
  try {
    window.localStorage.setItem(CLAVE_VOLUMEN, String(v));
  } catch {
    /* sin persistencia: se reinicia en la próxima visita */
  }
}

export function iniciarVolumen(): void {
  const control = document.querySelector<HTMLElement>('[data-volumen]');
  const video = document.querySelector<HTMLVideoElement>('[data-vsl-video]');
  if (!control || !video) return;

  const boton = control.querySelector<HTMLButtonElement>('[data-volumen-boton]');
  const deslizador = control.querySelector<HTMLInputElement>('[data-volumen-rango]');
  const ondas = control.querySelectorAll<SVGElement>('[data-volumen-onda]');
  const tachado = control.querySelector<SVGElement>('[data-volumen-tachado]');
  if (!boton || !deslizador) return;

  /**
   * Cuántas ondas se pintan. El corte no es lineal a tercios: por debajo del
   * 15% el sonido es prácticamente inaudible, así que ahí ya se muestra una
   * sola onda en vez de dos, y el salto a tres se reserva para un volumen
   * que de verdad se oye alto.
   */
  function ondasParaVolumen(v: number): number {
    if (v <= 0) return 0;
    if (v < 0.34) return 1;
    if (v < 0.7) return 2;
    return 3;
  }

  function pintar(): void {
    // El estado manda sobre el volumen: si no está sonando nada, no se
    // pintan ondas aunque el volumen esté al máximo.
    const sonando = !video!.paused && !video!.muted && video!.volume > 0;
    const cuantas = sonando ? ondasParaVolumen(video!.volume) : 0;

    ondas.forEach((onda, i) => {
      onda.style.display = i < cuantas ? '' : 'none';
    });

    // La bocina tachada solo cuando está silenciado a propósito, no cuando
    // simplemente no ha empezado a reproducirse.
    if (tachado) {
      tachado.style.display = video!.muted || video!.volume === 0 ? '' : 'none';
    }

    const pct = Math.round(video!.volume * 100);
    boton!.setAttribute(
      'aria-label',
      video!.muted || video!.volume === 0 ? 'Activar sonido' : `Volumen ${pct}%, ajustar`,
    );
    deslizador!.value = String(video!.muted ? 0 : pct);
    control!.classList.toggle('volumen--mudo', video!.muted || video!.volume === 0);
  }

  // Volumen inicial: el recordado, o el máximo la primera vez.
  const guardado = leerVolumen();
  video.volume = guardado ?? 1;

  boton.addEventListener('click', (evento) => {
    evento.stopPropagation();
    control.classList.toggle('volumen--abierto');
    if (control.classList.contains('volumen--abierto')) deslizador.focus();
  });

  deslizador.addEventListener('input', (evento) => {
    evento.stopPropagation();
    const v = Number(deslizador.value) / 100;
    video.volume = v;
    // Mover el deslizador a cero es silenciar, y subirlo desde cero es
    // volver a activar: sin esto, subir el deslizador con el video mudo no
    // haría nada y parecería roto.
    video.muted = v === 0;
    guardarVolumen(v);
    pintar();
  });

  // Que no se cierre al hacer clic dentro (el contenedor está dentro del
  // reproductor, que tiene sus propios listeners).
  control.addEventListener('click', (evento) => evento.stopPropagation());

  document.addEventListener('click', (evento) => {
    if (!control.contains(evento.target as Node)) control.classList.remove('volumen--abierto');
  });

  ['play', 'pause', 'volumechange', 'ended'].forEach((tipo) => {
    video.addEventListener(tipo, pintar);
  });

  pintar();
}
