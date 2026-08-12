/**
 * Las cifras del mentor, contando desde cero al entrar en pantalla.
 *
 * No hace falta marcar nada en el HTML: cada cifra ya trae su valor final
 * escrito ("+2 MILLONES", "+1.000", "+50"), y de ahí se saca el prefijo, el
 * número y el sufijo. Así el texto sigue siendo legible sin JS y sin
 * duplicar el dato en un atributo que se puede desincronizar.
 *
 * La curva es easeOutExpo: arranca de golpe y frena mucho al final, que es
 * como se lee un contador "acelerando hasta su valor". Una interpolación
 * lineal se siente mecánica, y una con rebote haría que la cifra pasara de
 * largo y volviera — en un número eso se lee como un error, no como estilo.
 *
 * Respeta prefers-reduced-motion: ahí la cifra aparece directamente en su
 * valor final, sin contar.
 */

const DURACION_MS = 1600;

interface Cifra {
  el: HTMLElement;
  prefijo: string;
  valor: number;
  sufijo: string;
  /** Si el original llevaba separador de miles, el resultado también. */
  conSeparador: boolean;
}

/** "+1.000 y pico" → { prefijo: "+", valor: 1000, sufijo: " y pico" } */
function analizar(el: HTMLElement): Cifra | null {
  const texto = (el.textContent ?? '').trim();
  const m = texto.match(/^(\D*?)([\d.,]+)(.*)$/s);
  if (!m) return null;

  const [, prefijo, crudo, sufijo] = m;
  if (crudo === undefined) return null;

  // Se quitan los separadores de miles para tener el número real. Se asume
  // que no hay decimales: en estas cifras no los hay, y tratar el punto como
  // decimal convertiría "1.000" en 1.
  const valor = Number(crudo.replace(/[.,]/g, ''));
  if (!Number.isFinite(valor)) return null;

  return {
    el,
    prefijo: prefijo ?? '',
    valor,
    sufijo: sufijo ?? '',
    conSeparador: /[.,]/.test(crudo),
  };
}

function pintar(c: Cifra, valor: number): void {
  const n = Math.round(valor);
  const texto = c.conSeparador ? n.toLocaleString('es-CO') : String(n);
  c.el.textContent = `${c.prefijo}${texto}${c.sufijo}`;
}

function animar(c: Cifra): void {
  const inicio = performance.now();

  const paso = (ahora: number): void => {
    const t = Math.min((ahora - inicio) / DURACION_MS, 1);
    // easeOutExpo: rápido al principio, casi detenido al final.
    const suave = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    pintar(c, c.valor * suave);
    if (t < 1) requestAnimationFrame(paso);
  };

  requestAnimationFrame(paso);
}

export function iniciarCifras(): void {
  const elementos = document.querySelectorAll<HTMLElement>('.mentor__cifra');
  if (elementos.length === 0) return;

  const cifras = [...elementos].map(analizar).filter((c): c is Cifra => c !== null);
  if (cifras.length === 0) return;

  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinMovimiento || !('IntersectionObserver' in window)) return; // se quedan en su valor final

  // Se ponen a cero solo cuando ya se sabe que van a animarse. Hacerlo antes
  // dejaría un "+0" fijo en pantalla si algo fallara después.
  cifras.forEach((c) => pintar(c, 0));

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const cifra = cifras.find((c) => c.el === entrada.target);
        observador.unobserve(entrada.target); // una sola vez, no re-anima al volver
        if (cifra) animar(cifra);
      }
    },
    { threshold: 0.6 },
  );

  cifras.forEach((c) => observador.observe(c.el));
}
