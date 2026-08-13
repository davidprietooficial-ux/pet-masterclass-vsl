/**
 * Punto de entrada.
 *
 * El orden importa y no es arbitrario:
 *   1. Estilos, para que no haya destello sin estilar.
 *   2. Consentimiento, porque todo lo demás depende de él.
 *   3. Interfaz (navegación, revelado, oferta): funciona sin permisos.
 *   4. Tracking, que queda en cola hasta que haya consentimiento.
 *
 * Todo el JS de este archivo es de mejora progresiva: si falla, la página
 * sigue leyéndose y los enlaces siguen funcionando.
 */

import './estilos/tokens.css';
import './estilos/sitio.css';

import { iniciarConsentimiento } from './lib/consentimiento';
import { iniciarRevelado, iniciarContadores } from './lib/revelar';
import { iniciarOferta } from './lib/oferta';
import { iniciarAltoBanner } from './lib/banner';
import { iniciarContadorEntradas } from './lib/contador-vivo';
import { iniciarVideosTestimonios } from './lib/testimonios';
import { iniciarReproductores } from './lib/reproductor';
import { iniciarPitch } from './lib/pitch';
import { iniciarRetencion } from './lib/retencion';
import { iniciarCtaFlotante } from './lib/cta-flotante';
import { iniciarVolumen } from './lib/volumen';
import { iniciarCheckout } from './lib/checkout';
import { iniciarBannersVideo } from './lib/banner-video';
import { iniciarCifras } from './lib/cifras';
import { iniciarFormulario } from './lib/formulario';
import { iniciarTracking, registrarConversiones } from './lib/tracking';

// ── Preguntas frecuentes ──────────────────────────────────────────────

function iniciarFaq(): void {
  // Se usa <details>, que ya es accesible y funciona sin JS. Esto solo
  // añade el cierre de las demás al abrir una.
  const grupo = document.querySelectorAll<HTMLDetailsElement>('[data-faq] details');
  grupo.forEach((d) => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      grupo.forEach((otra) => {
        if (otra !== d) otra.open = false;
      });
    });
  });
}

// ── Video de fondo del hero ─────────────────────────────────────────────

function iniciarVideoHero(): void {
  // autoplay/muted/loop ya está en el HTML (fail-open: funciona sin JS).
  // Esto solo lo pausa si el usuario prefiere menos movimiento — no hay
  // forma de que un atributo HTML lea esa preferencia por su cuenta.
  const video = document.querySelector<HTMLVideoElement>('[data-video-hero]');
  if (!video) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.pause();
  }
}

// ── Año del pie ───────────────────────────────────────────────────────

function actualizarAno(): void {
  const el = document.querySelector('[data-ano]');
  if (el) el.textContent = String(new Date().getFullYear());
}

// ── Arranque ──────────────────────────────────────────────────────────

function iniciar(): void {
  // `no-js` ya la quitó el script inline del <head> — se repite acá por si
  // ese inline no llegara a correr (una CSP mal puesta, por ejemplo). Es
  // idempotente.
  document.documentElement.classList.remove('no-js');

  iniciarConsentimiento();

  // La puerta primero: si el visitante aún no se registró, es lo único
  // con lo que puede interactuar.
  iniciarFormulario();

  // El reproductor primero: pitch.ts y retencion.ts se cuelgan del mismo
  // <video>, y conviene que el elemento ya esté enganchado y sin los
  // controles nativos antes de que nadie más lo mire.
  iniciarReproductores();
  iniciarVolumen();
  iniciarPitch();
  iniciarRetencion();

  iniciarRevelado();
  iniciarContadores();
  iniciarCifras();
  iniciarFaq();
  iniciarOferta();
  iniciarCheckout();
  iniciarAltoBanner();
  iniciarCtaFlotante();
  iniciarContadorEntradas();
  iniciarVideosTestimonios();
  iniciarVideoHero();
  iniciarBannersVideo();
  actualizarAno();

  iniciarTracking();
  registrarConversiones();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
