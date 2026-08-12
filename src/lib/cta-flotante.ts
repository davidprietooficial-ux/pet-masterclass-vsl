/**
 * El botón de compra, flotando cuando hace falta.
 *
 * En el hero se ve donde está, bajo el video. En cuanto el visitante baja a
 * las demás secciones, el mismo botón pasa a una franja fija abajo de la
 * pantalla, para que pueda comprar en cualquier momento sin volver arriba.
 * Al subir de nuevo al hero, vuelve a su sitio.
 *
 * Se mueve una CLASE, no el nodo: mover el <a> de un contenedor a otro
 * perdería el foco de teclado a mitad de scroll y obligaría a reenganchar
 * los listeners de oferta.ts, tracking.ts y retencion.ts, que ya están
 * puestos sobre ese elemento concreto. Un cambio de clase no toca nada de
 * eso.
 *
 * Dos detalles que evitan saltos de layout:
 *   - El div de anclaje conserva la altura del botón mientras este flota
 *     (se mide y se fija antes de despegarlo). Sin eso, el hero se encogería
 *     de golpe justo cuando el visitante está scrolleando.
 *   - Mientras flota, se reserva ese mismo alto como padding al final de la
 *     página, para que la franja no tape el pie.
 */

const CLASE_FLOTANTE = 'cta--flotante';

export function iniciarCtaFlotante(): void {
  const anclaje = document.querySelector<HTMLElement>('[data-cta-anclaje]');
  const boton = anclaje?.querySelector<HTMLElement>('[data-cta-compra]');
  if (!anclaje || !boton) return;

  // Sin IntersectionObserver (navegador muy viejo) el botón se queda fijo en
  // su sitio: se pierde la comodidad de la franja, no el botón.
  if (!('IntersectionObserver' in window)) return;

  const fijarAlto = (): void => {
    // Solo se mide con el botón en su sitio; midiendo mientras flota daría 0
    // (está fuera del flujo) y el anclaje colapsaría.
    if (boton.classList.contains(CLASE_FLOTANTE)) return;
    const alto = boton.offsetHeight;
    if (alto > 0) {
      anclaje.style.minHeight = `${alto}px`;
      document.documentElement.style.setProperty('--cta-flotante-alto', `${alto}px`);
    }
  };

  const flotar = (debe: boolean): void => {
    boton.classList.toggle(CLASE_FLOTANTE, debe);
    document.body.classList.toggle('con-cta-flotante', debe);
  };

  fijarAlto();
  new ResizeObserver(fijarAlto).observe(boton);

  const observador = new IntersectionObserver(
    (entradas) => {
      const entrada = entradas[entradas.length - 1];
      if (!entrada) return;
      // Flota solo cuando el anclaje quedó ARRIBA del viewport, es decir
      // cuando el visitante ya bajó del hero. Sin comprobar la posición,
      // "no se ve" también sería cierto antes de llegar a él (imposible
      // aquí, pero rompería en cuanto el botón dejara de ser lo primero) y
      // en cuanto el pitch lo esconde con display:none — ahí el botón no
      // existe en pantalla y no debe aparecer flotando.
      const fueraPorArriba = !entrada.isIntersecting && entrada.boundingClientRect.top < 0;
      flotar(fueraPorArriba);
    },
    { threshold: 0 },
  );

  observador.observe(anclaje);

  // Al desplegarse el pitch, el anclaje pasa de display:none a visible: hay
  // que medirlo entonces, porque hasta ese momento su alto era 0.
  document.addEventListener('pitch-desbloqueado', () => {
    window.requestAnimationFrame(fijarAlto);
  });
}
