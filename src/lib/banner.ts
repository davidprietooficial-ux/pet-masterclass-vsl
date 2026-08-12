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
    document.documentElement.style.setProperty('--banner-alto', `${banner.offsetHeight}px`);
  };

  fijarAlto();
  new ResizeObserver(fijarAlto).observe(banner);
}
