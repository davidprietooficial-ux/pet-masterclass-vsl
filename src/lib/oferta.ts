/**
 * Corte de 24h de la oferta, en modo evergreen.
 *
 * A diferencia del webinar en vivo (una fecha de corte única para todos), la
 * clase ahora es pregrabada y cada quien la ve cuando quiere: el reloj arranca
 * por visitante, cuando llega al pitch del video, y se guarda en localStorage
 * para que sobreviva a recargas y a cerrar el navegador.
 *
 * Un solo mecanismo genérico, igual que antes:
 *
 *   [data-cta-compra]              → su href se pone en el enlace correcto
 *   [data-oferta-estado="activa"]  → visible solo mientras la oferta corre
 *   [data-oferta-estado="vencida"] → visible solo después del corte
 *   [data-cuenta-regresiva]        → texto "23:59:59" (HH:MM:SS), tic cada segundo
 *   [data-cuenta-progreso]         → barra de progreso, % transcurrido de las 24h
 *   [data-modulos-grid]            → pierde la columna del bono (clase
 *                                     .sin-destacado) cuando la oferta vence
 *
 * ?vista=vencida en la URL fuerza el estado vencido sin esperar al corte real
 * — para previsualizar cómo queda la página pasadas las 24h. No se documenta
 * en la interfaz, es solo para quien construye el sitio.
 *
 * Sin JS, el HTML ya trae por defecto el estado "activa" con el enlace de
 * oferta. Es lo correcto: quien no puede ejecutar JS tampoco pudo ver el video
 * ni desbloquear nada, así que darle la oferta buena es el error benigno. El
 * caso contrario —cobrarle de más a alguien por un fallo del navegador— sí
 * sería un problema.
 */

import {
  DURACION_OFERTA_HORAS,
  DISPARADOR_OFERTA,
  ENLACE_OFERTA,
  ENLACE_REGULAR,
} from '../datos/oferta';
import { pitchYaDesbloqueado } from './pitch';

const CLAVE_FIN = 'pet-oferta-fin';
const DURACION_MS = DURACION_OFERTA_HORAS * 60 * 60 * 1000;

/** Momento en que termina la oferta de este visitante, o null si aún no arrancó. */
function leerFin(): number | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_FIN);
    if (!crudo) return null;
    const ms = Number(crudo);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

/**
 * Arranca el reloj. Solo la primera vez: si ya había una marca guardada se
 * respeta, para que recargar la página no le regale otras 24 horas a nadie.
 */
function arrancarReloj(): number {
  const yaGuardado = leerFin();
  if (yaGuardado !== null) return yaGuardado;

  const fin = Date.now() + DURACION_MS;
  try {
    window.localStorage.setItem(CLAVE_FIN, String(fin));
  } catch {
    /* sin persistencia la ventana se reinicia en cada visita; es el modo
       degradado aceptable, y solo afecta a quien tenga el almacenamiento
       bloqueado */
  }
  return fin;
}

let finOferta: number | null = null;

function ofertaActiva(): boolean {
  if (new URLSearchParams(location.search).get('vista') === 'vencida') return false;
  // Todavía sin arrancar (no ha llegado al pitch): la oferta cuenta como
  // activa. Nada de lo que depende del contador está visible aún de todos
  // modos, porque la página sigue bloqueada.
  if (finOferta === null) return true;
  return Date.now() < finOferta;
}

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

function formatearRestante(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;
  return `${dosDigitos(horas)}:${dosDigitos(min)}:${dosDigitos(seg)}`;
}

function aplicarEstado(): void {
  const activa = ofertaActiva();

  document.querySelectorAll<HTMLAnchorElement>('[data-cta-compra]').forEach((a) => {
    a.href = activa ? ENLACE_OFERTA : ENLACE_REGULAR;
  });

  document.querySelectorAll<HTMLElement>('[data-oferta-estado="activa"]').forEach((el) => {
    el.hidden = !activa;
  });
  document.querySelectorAll<HTMLElement>('[data-oferta-estado="vencida"]').forEach((el) => {
    el.hidden = activa;
  });

  document.querySelectorAll<HTMLElement>('[data-modulos-grid]').forEach((el) => {
    el.classList.toggle('sin-destacado', !activa);
  });

  if (!activa || finOferta === null) return;

  const restanteMs = finOferta - Date.now();
  const restanteTexto = formatearRestante(restanteMs);
  document.querySelectorAll<HTMLElement>('[data-cuenta-regresiva]').forEach((el) => {
    el.textContent = restanteTexto;
  });

  const transcurridoMs = Math.min(Math.max(DURACION_MS - restanteMs, 0), DURACION_MS);
  const pct = Math.round((transcurridoMs / DURACION_MS) * 100);
  document.querySelectorAll<HTMLElement>('[data-cuenta-progreso]').forEach((el) => {
    el.style.width = `${pct}%`;
    el.setAttribute('aria-valuenow', String(pct));
  });
}

export function iniciarOferta(): void {
  finOferta = leerFin();

  if (finOferta === null) {
    // Se consulta el estado del pitch además de escuchar el evento, y no
    // solo el evento: iniciarPitch() corre antes que esto en main.ts, así
    // que a un visitante que ya venía desbloqueado de otra sesión su
    // `pitch-desbloqueado` se le emite antes de que exista el listener de
    // abajo. Depender solo del evento dejaba el contador congelado en
    // 24:00:00 para siempre en ese caso.
    if (DISPARADOR_OFERTA === 'primera_visita' || pitchYaDesbloqueado()) {
      finOferta = arrancarReloj();
    }
  }

  // El disparador por defecto: el reloj empieza cuando el visitante llega al
  // pitch. Si arrancara al abrir la página, quien ve una clase de 60 minutos
  // habría quemado una hora de su oferta antes de enterarse de que existe.
  document.addEventListener('pitch-desbloqueado', () => {
    if (DISPARADOR_OFERTA !== 'desbloqueo_pitch') return;
    finOferta = arrancarReloj();
    aplicarEstado();
  });

  aplicarEstado();
  window.setInterval(aplicarEstado, 1000);

  // La conversión NO se dispara acá: la emite lib/checkout.ts una sola vez
  // por sesión, con su id de evento. Si cada botón la emitiera por su cuenta,
  // quien pulsa dos contaría como dos conversiones y el coste por conversión
  // de la campaña saldría mal.
}
