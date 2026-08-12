/**
 * Reproductor de video nativo para los testimonios (sin YouTube, sin
 * iframes de terceros). Cada tarjeta trae su propio <video>, que arranca
 * con el atributo `controls` puesto en el HTML — fail-open: si este script
 * no llega a correr, el navegador igual deja reproducirlo con sus
 * controles nativos. Recién se le quita `controls` al final, cuando el
 * botón y la barra ya están enganchados.
 *
 * Dos modos, no uno:
 *  - Vista previa: mientras la tarjeta está a la vista (IntersectionObserver),
 *    el video se repite en bucle, mudo, de fondo — el botón de play se queda
 *    encima todo el tiempo, como invitación a verlo de verdad.
 *  - Reproducción real: al hacer clic, el video vuelve al segundo 0, se le
 *    quita el mute y reproduce una sola vez con sonido.
 *
 * Solo un video con sonido a la vez, pero pedido explícito (2026-08-09): el
 * anterior no se pausa sin más — vuelve a su vista previa muda en bucle,
 * igual que las otras tarjetas que nunca se tocaron. Por eso "con sonido"
 * ya no es un flag por tarjeta que solo pasa de false a true una vez
 * (conSonido); es un único video compartido entre todas (videoConSonido),
 * así cualquier tarjeta puede volver atrás cuando otra toma el sonido.
 *
 * video.load() antes de reproducir con sonido: bug real reportado en
 * dispositivo real (persistía incluso pausando+reproduciendo el mismo
 * <video>) — el sonido solo se escuchaba en la primera tarjeta. La
 * sospecha, dado que no se pudo reproducir en Chromium/Playwright (ahí
 * sonaba bien en las 4): algunas variantes de Safari en iOS conservan un
 * "no fue gesto real" en la sesión de reproducción de un <video> que ya
 * arrancó en autoplay mudo, incluso tras pausarlo y volver a llamar
 * play(). video.load() fuerza una sesión de reproducción completamente
 * nueva (aborta cualquier estado previo) — atada sin ambigüedad al clic
 * actual.
 */
export function iniciarVideosTestimonios(): void {
  const tarjetas: { video: HTMLVideoElement; volverAVistaPrevia: () => void }[] = [];
  let videoConSonido: HTMLVideoElement | null = null;

  document.querySelectorAll<HTMLElement>('[data-reproductor]').forEach((contenedor) => {
    const video = contenedor.querySelector<HTMLVideoElement>('[data-reproductor-video]');
    const boton = contenedor.querySelector<HTMLButtonElement>('[data-reproductor-boton]');
    const iconoPlay = contenedor.querySelector<SVGElement>('[data-icono-play]');
    const iconoPausa = contenedor.querySelector<SVGElement>('[data-icono-pausa]');
    const barra = contenedor.querySelector<HTMLElement>('[data-reproductor-barra]');
    const relleno = contenedor.querySelector<HTMLElement>('[data-reproductor-relleno]');
    if (!video || !boton || !iconoPlay || !iconoPausa || !barra || !relleno) return;

    const esElActivo = () => videoConSonido === video;

    const actualizarBoton = () => {
      const mostrarPlay = !esElActivo() || video.paused;
      iconoPlay.style.display = mostrarPlay ? '' : 'none';
      iconoPausa.style.display = mostrarPlay ? 'none' : '';
      boton.setAttribute('aria-label', mostrarPlay ? 'Reproducir video' : 'Pausar video');
      // El botón solo se esconde en reproducción real activa — durante la
      // vista previa muda se queda siempre visible.
      contenedor.classList.toggle('reproductor--reproduciendo', esElActivo() && !video.paused);
    };

    const volverAVistaPrevia = () => {
      video.loop = true;
      video.muted = true;
      video.play().catch(() => {});
      actualizarBoton();
    };

    tarjetas.push({ video, volverAVistaPrevia });

    contenedor.addEventListener('click', () => {
      if (!esElActivo()) {
        // Si había otra tarjeta con sonido, vuelve a su vista previa muda
        // en vez de quedarse pausada — pedido explícito. videoConSonido
        // se actualiza ANTES de llamar a su volverAVistaPrevia() para que
        // el actualizarBoton() de esa tarjeta (esElActivo() ya en false)
        // le muestre el ícono de play correcto.
        const anterior = videoConSonido;
        videoConSonido = video;
        if (anterior) {
          tarjetas.find((t) => t.video === anterior)?.volverAVistaPrevia();
        }

        video.pause();
        video.loop = false;
        video.muted = false;
        video.load();
        video.currentTime = 0;
        // El video ya venía reproduciéndose (el bucle mudo de la vista
        // previa) — al estar ya en marcha, play() de nuevo no dispara un
        // evento 'play' nuevo, así que el botón no se actualizaría solo.
        // Por eso actualizarBoton() se llama a mano, no solo por eventos.
        video.play().catch(() => {});
      } else if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      actualizarBoton();
    });

    video.addEventListener('play', actualizarBoton);
    video.addEventListener('pause', actualizarBoton);

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const porcentaje = (video.currentTime / video.duration) * 100;
      relleno.style.width = `${porcentaje}%`;
      barra.setAttribute('aria-valuenow', String(Math.round(porcentaje)));
    });

    // Vista previa: solo se reproduce en bucle mudo mientras está a la
    // vista, y solo si no es la tarjeta con sonido activo ahora mismo.
    //
    // El "else" (pausar al salir de vista) también se restringe a
    // !esElActivo(): en reproducción real, un tap en el botón de play que
    // esté parcialmente fuera de pantalla hace que el navegador
    // scrollee la tarjeta a la vista — ese scroll cruza el threshold de
    // 0.6 y este observador pausaba el video justo después de arrancar
    // con sonido.
    const observador = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[0];
        if (!entrada) return;
        if (entrada.isIntersecting) {
          if (!esElActivo()) {
            video.loop = true;
            video.muted = true;
            video.play().catch(() => {});
          }
        } else if (!esElActivo()) {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );

    actualizarBoton();
    video.removeAttribute('controls');
    observador.observe(contenedor);
  });
}
