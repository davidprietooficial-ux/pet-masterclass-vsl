/**
 * Los banners en video, arrancados solo cuando entran en pantalla.
 *
 * Con `autoplay` en el HTML, el navegador empieza a descargarlos en cuanto
 * parsea la página — a la vez que el VSL, que es el que de verdad importa.
 * En la vista de inicio eso son dos videos compitiendo por el ancho de banda
 * en el primer segundo, y el LCP se iba justo al límite de los 2.5s.
 *
 * Acá arrancan al entrar en el viewport. El banner es decorativo y está muy
 * por debajo del pliegue: nadie nota la diferencia, y el arranque de la
 * página deja de pagarla.
 *
 * Sin JS no se reproducen (el HTML ya no lleva `autoplay`), pero conservan su
 * `poster`, así que se ve la imagen en vez de un hueco negro. Para una pieza
 * decorativa es el modo degradado correcto.
 */

export function iniciarBannersVideo(): void {
  const banners = document.querySelectorAll<HTMLVideoElement>('[data-banner-video]');
  if (banners.length === 0) return;

  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinMovimiento) return; // se quedan en el poster, que es justo lo que se pide

  if (!('IntersectionObserver' in window)) {
    banners.forEach((v) => void v.play().catch(() => {}));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        const video = entrada.target as HTMLVideoElement;
        if (entrada.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          // Fuera de pantalla se pausa: un bucle decodificando donde nadie lo
          // ve gasta batería en móvil sin aportar nada.
          video.pause();
        }
      }
    },
    { rootMargin: '200px 0px' },
  );

  banners.forEach((v) => observador.observe(v));
}
