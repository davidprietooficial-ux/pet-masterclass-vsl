/**
 * Alto real del banner de oferta, medido y escrito en --banner-alto.
 *
 * Fijarlo a mano por breakpoint no alcanza: el texto envuelve distinto
 * según el ancho exacto (64px a 360px de viewport, 48px a 390px — no hay
 * un patrón limpio de 3 escalones ahí) y --banner-alto tiene que pasar a
 * 0 justo cuando la oferta vence y el banner desaparece (hidden). Un
 * ResizeObserver reacciona a los dos casos sin lógica aparte para cada uno.
 */
export function iniciarAltoBanner(): void {
  const banner = document.querySelector<HTMLElement>('[data-block="oferta-banner"]');
  if (!banner) return;

  const fijarAlto = () => {
    const alto = banner.offsetHeight;

    // Con alto 0 NO se toca la variable: mientras la página está bloqueada,
    // el banner está en display:none y mide 0. Si se escribiera ese 0, el
    // body perdería su padding superior y, al desplegarse la oferta, el
    // banner empujaría todo el contenido hacia abajo de golpe — justo el
    // salto que hay que evitar. Dejando el fallback del CSS, el hueco está
    // reservado desde el principio y el banner solo aparece dentro de él.
    //
    // La excepción de verdad —oferta vencida, banner que desaparece para
    // siempre— la cubre `data-oferta-estado`, que sí quita el elemento del
    // flujo y ahí sí conviene recuperar el espacio; por eso se comprueba
    // aparte y no por el alto.
    if (alto > 0) {
      document.documentElement.style.setProperty('--banner-alto', `${alto}px`);
      return;
    }

    const vencida = banner.hidden;
    if (vencida) document.documentElement.style.setProperty('--banner-alto', '0px');
  };

  fijarAlto();
  new ResizeObserver(fijarAlto).observe(banner);
}
