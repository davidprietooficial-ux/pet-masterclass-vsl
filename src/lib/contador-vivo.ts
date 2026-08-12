/**
 * Píldora "Ya están viendo N" del hero — prueba social.
 *
 * Sube y baja, pero sube mucho más de lo que baja: los saltos hacia arriba
 * son de 20 a 45 y los de bajada de 5 a 10. El efecto neto es una cifra que
 * respira —entra y sale gente, como en una clase en vivo— pero que en el
 * conjunto de la visita solo crece.
 *
 * Nunca se queda quieta: el tope está en 700, muy por encima de lo que puede
 * alcanzar en una visita real, así que el movimiento no se corta a mitad de
 * página. Que un contador "en vivo" se congele es peor que no tenerlo, y con
 * un tope bajo se congelaba a los pocos minutos.
 *
 * Con prefers-reduced-motion no hay nada que animar en sentido visual (es
 * texto, no transform), pero se respeta el espíritu: se muestra un valor
 * estable y no se toca más.
 */
const INICIO = 105;
const TOPE = 700;

const SUBIDA_MIN = 20;
const SUBIDA_MAX = 45;
const BAJADA_MIN = 5;
const BAJADA_MAX = 10;

/** Cuántos de cada 10 movimientos son hacia arriba. */
const PROPORCION_SUBIDAS = 0.75;

const ESPERA_MIN_MS = 4_000;
const ESPERA_MAX_MS = 9_000;

const entre = (min: number, max: number): number => min + Math.random() * (max - min);

export function iniciarContadorEntradas(): void {
  const el = document.querySelector<HTMLElement>('[data-contador-vivo-numero]');
  if (!el) return;

  let valor = INICIO;
  el.textContent = String(valor);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const siguientePaso = (): void => {
    window.setTimeout(() => {
      const sube = Math.random() < PROPORCION_SUBIDAS;
      const salto = Math.round(sube ? entre(SUBIDA_MIN, SUBIDA_MAX) : -entre(BAJADA_MIN, BAJADA_MAX));

      // Suelo en el valor inicial: sin él, una racha de bajadas al principio
      // dejaría la cifra por debajo de 105, que es justo lo contrario de lo
      // que la píldora quiere transmitir.
      valor = Math.min(TOPE, Math.max(INICIO, valor + salto));
      el.textContent = String(valor);
      siguientePaso();
    }, entre(ESPERA_MIN_MS, ESPERA_MAX_MS));
  };

  siguientePaso();
}
