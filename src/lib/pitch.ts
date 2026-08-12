/**
 * El pitch: el momento del video en que se despliega el botón de compra y el
 * resto de la página.
 *
 * Cómo se oculta el contenido, y por qué así:
 *
 *   El <html> viene del servidor con `class="no-js pitch-bloqueado"`, y el CSS
 *   oculta `[data-pitch]` solo cuando se dan las dos: `pitch-bloqueado` Y NO
 *   `no-js`. Un script inline en el <head> de index.html quita `no-js` y, si
 *   el visitante ya llegó al pitch en una visita anterior, quita también
 *   `pitch-bloqueado`.
 *
 *   - Con JS bloqueado, ese inline tampoco corre: `no-js` se queda puesta, el
 *     selector no aplica y la página se ve entera. Es el fail-open que exige
 *     el proyecto — nunca se pierde contenido por no poder ejecutar JS.
 *   - El estado queda resuelto en el <head>, antes del primer pintado, así que
 *     no hay flash de la página completa ni salto de layout (CLS < 0.1).
 *   - El contenido está entero en el HTML, solo oculto por CSS: sigue siendo
 *     rastreable para SEO.
 *
 * Este archivo solo se ocupa de lo que el inline no puede: mirar el video y
 * desbloquear cuando toca.
 */

import { SEGUNDO_PITCH, PCT_PITCH } from '../datos/vsl';

const CLAVE_PITCH = 'pet-vsl-pitch';

export function pitchYaDesbloqueado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PITCH) === '1';
  } catch {
    return false;
  }
}

function recordarDesbloqueo(): void {
  try {
    window.localStorage.setItem(CLAVE_PITCH, '1');
  } catch {
    /* sin persistencia: en la próxima visita tendrá que volver a llegar */
  }
}

let desbloqueado = false;

export function desbloquearPitch(): void {
  if (desbloqueado) return;
  desbloqueado = true;

  recordarDesbloqueo();
  document.documentElement.classList.remove('pitch-bloqueado');
  document.dispatchEvent(new CustomEvent('pitch-desbloqueado'));
}

/**
 * ¿Ya se pasó el punto del pitch? SEGUNDO_PITCH manda si está puesto; si no,
 * se cae a PCT_PITCH sobre la duración real. Con el video sin cargar todavía,
 * `duration` es NaN — de ahí el Number.isFinite.
 */
function pasoElPitch(video: HTMLVideoElement): boolean {
  if (SEGUNDO_PITCH > 0) return video.currentTime >= SEGUNDO_PITCH;
  if (PCT_PITCH > 0 && Number.isFinite(video.duration) && video.duration > 0) {
    return (video.currentTime / video.duration) * 100 >= PCT_PITCH;
  }
  return false;
}

export function iniciarPitch(): void {
  // Ya venía desbloqueado de otra visita: el inline del <head> ya quitó la
  // clase, aquí solo se avisa a quien escucha (oferta.ts, retencion.ts) y se
  // deja de mirar el video.
  if (pitchYaDesbloqueado()) {
    desbloqueado = true;
    document.dispatchEvent(new CustomEvent('pitch-desbloqueado'));
    return;
  }

  const video = document.querySelector<HTMLVideoElement>('[data-vsl-video]');
  if (!video) return;

  // Se empieza a mirar el video recién cuando el visitante le da al botón.
  // Antes de eso está corriendo la previa muda detrás del desenfoque, y esa
  // no cuenta: si contara, el video correría solo hasta el minuto del pitch
  // y desbloquearía la oferta sin que nadie hubiera visto la clase.
  document.addEventListener(
    'vsl-arrancado',
    () => {
      const alAvanzar = (): void => {
        if (!pasoElPitch(video)) return;
        video.removeEventListener('timeupdate', alAvanzar);
        desbloquearPitch();
      };

      video.addEventListener('timeupdate', alAvanzar);

      // Si el video termina antes de llegar al punto configurado (pitch mal
      // puesto, o video más corto de lo previsto), se desbloquea igual:
      // dejar a alguien que vio la clase entera sin forma de comprar sería
      // el peor fallo posible de esta página.
      video.addEventListener('ended', desbloquearPitch, { once: true });
    },
    { once: true },
  );
}
