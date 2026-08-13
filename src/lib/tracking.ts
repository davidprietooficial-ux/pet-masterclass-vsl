/**
 * Píxeles y analítica. Todo en cola hasta el consentimiento.
 *
 * Si un ID está vacío, ese proveedor sencillamente no se registra: no se
 * carga un script "por si acaso".
 */

import { alConsentir } from './consentimiento';

// Vacío = no se carga.
export const IDS = {
  metaPixel: '',
  ga4: '',
  gtm: '',
  googleAds: '',
  tiktokPixel: '',
  clarity: '',
} as const;

// La CSP trae require-trusted-types-for 'script' + trusted-types
// scripts-analitica: cualquier asignación a <script>.src tiene que pasar
// por esta política nombrada, o el navegador la bloquea — incluida
// cualquiera que intente crear un script inyectado por una dependencia
// comprometida o una extensión maliciosa, porque esas no conocen el
// nombre de la política. La lista blanca es a propósito angosta: solo
// los dominios de analítica que este archivo realmente carga.
declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (
        name: string,
        rules: { createScriptURL: (input: string) => string },
      ) => { createScriptURL: (input: string) => unknown };
    };
  }
}
const DOMINIOS_SCRIPT_PERMITIDOS = [
  'https://www.googletagmanager.com/',
  'https://connect.facebook.net/',
  'https://analytics.tiktok.com/',
  'https://www.clarity.ms/',
];
const politicaScripts = window.trustedTypes?.createPolicy('scripts-analitica', {
  createScriptURL: (url) => {
    if (!DOMINIOS_SCRIPT_PERMITIDOS.some((d) => url.startsWith(d))) {
      throw new Error(`URL de script fuera de la lista blanca: ${url}`);
    }
    return url;
  },
});

/**
 * Carga un script externo de forma diferida.
 * Se marca async y se añade al final: nunca bloquea el render.
 */
function cargarScript(src: string, atributos: Record<string, string> = {}): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = (politicaScripts ? politicaScripts.createScriptURL(src) : src) as string;
    s.async = true;
    for (const [k, v] of Object.entries(atributos)) s.setAttribute(k, v);
    s.onload = () => resolver();
    s.onerror = () => rechazar(new Error(`No se pudo cargar ${src}`));
    document.head.append(s);
  });
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { load: (id: string) => void; page: () => void };
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

export function iniciarTracking(): void {
  // ── Google Analytics 4 · categoría analítica ────────────────────────
  if (IDS.ga4) {
    alConsentir('analitica', 'Google Analytics 4', async () => {
      await cargarScript(`https://www.googletagmanager.com/gtag/js?id=${IDS.ga4}`);
      window.dataLayer = window.dataLayer ?? [];
      const gtag = (...args: unknown[]): void => {
        window.dataLayer!.push(args);
      };
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', IDS.ga4, { anonymize_ip: true });
    });
  }

  // ── Google Tag Manager · analítica ──────────────────────────────────
  if (IDS.gtm) {
    alConsentir('analitica', 'Google Tag Manager', async () => {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      await cargarScript(`https://www.googletagmanager.com/gtm.js?id=${IDS.gtm}`);
    });
  }

  // ── Meta Pixel · marketing ──────────────────────────────────────────
  if (IDS.metaPixel) {
    alConsentir('marketing', 'Meta Pixel', async () => {
      await cargarScript('https://connect.facebook.net/en_US/fbevents.js');
      window.fbq?.('init', IDS.metaPixel);
      window.fbq?.('track', 'PageView');
    });
  }

  // ── TikTok · marketing ──────────────────────────────────────────────
  if (IDS.tiktokPixel) {
    alConsentir('marketing', 'TikTok Pixel', async () => {
      await cargarScript('https://analytics.tiktok.com/i18n/pixel/events.js');
      window.ttq?.load(IDS.tiktokPixel);
      window.ttq?.page();
    });
  }

  // ── Microsoft Clarity · categoría analítica ─────────────────────────
  // Grabaciones de sesión y mapas de calor: es lo que permite VER dónde se
  // atasca la gente, no solo contarlo. Va en 'analitica' y no en
  // 'marketing' porque no construye perfiles publicitarios ni comparte los
  // datos con una red de anuncios.
  //
  // La cola `clarity.q` es el patrón del propio Clarity: deja registrar
  // eventos desde el primer instante aunque su script todavía esté
  // cargando, y él los procesa al arrancar. Sin ella, los eventos que se
  // disparen en ese hueco se pierden.
  if (IDS.clarity) {
    alConsentir('analitica', 'Microsoft Clarity', async () => {
      const cola: unknown[] = [];
      const clarity = ((...args: unknown[]) => {
        cola.push(args);
      }) as NonNullable<Window['clarity']>;
      clarity.q = cola;
      window.clarity = clarity;
      await cargarScript(`https://www.clarity.ms/tag/${IDS.clarity}`);
    });
  }
}

/**
 * Conversiones. Se disparan desde la interfaz (clic en WhatsApp, envío de
 * formulario) y solo llegan a los proveedores que tengan permiso.
 */
export function registrarConversiones(): void {
  const enviar = (nombre: string, datos: Record<string, unknown> = {}): void => {
    // El dataLayer va PRIMERO y es el camino principal: con GTM montado,
    // todo (GA4, Clarity, el Píxel, Google Ads) se configura desde su
    // interfaz sin volver a tocar este archivo. Cada evento de aquí aparece
    // en GTM como un disparador con ese nombre.
    //
    // Se empuja siempre, haya consentimiento o no: el dataLayer es un array
    // en memoria de esta misma página, no una petición de red. Quien decide
    // si eso sale a algún sitio es GTM, que solo llega a cargarse cuando el
    // banner de cookies da permiso.
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: nombre, ...datos });

    // Y las llamadas directas siguen, para que los eventos no se pierdan si
    // algún proveedor se configura por ID en vez de por GTM.
    window.gtag?.('event', nombre, datos);
    window.fbq?.('trackCustom', nombre, datos);
    // En Clarity los eventos se convierten en filtros para buscar
    // grabaciones: "enséñame las sesiones de quien pulsó comprar" o "las de
    // quien llegó al pitch". Es lo que hace útiles las grabaciones, en vez
    // de tener que verlas todas.
    window.clarity?.('event', nombre);
  };

  document.addEventListener('conversion', (e) => {
    const detalle = (e as CustomEvent<{ tipo: string; evento_id?: string }>).detail;
    const tipo = detalle?.tipo ?? 'desconocido';

    enviar('conversion', { tipo });

    // El clic en comprar, además, va al Pixel como InitiateCheckout — el
    // evento estándar de Meta para "empezó el proceso de compra". Un evento
    // estándar y no uno custom porque es el que los algoritmos de
    // optimización de campaña saben interpretar; un trackCustom no le sirve
    // a Meta para optimizar hacia compradores.
    //
    // eventID es la clave de la deduplicación: lib/checkout.ts emite un solo
    // id por sesión aunque el visitante pulse varios botones distintos, así
    // que Meta cuenta UNA conversión. Ese mismo id sirve además para cruzar
    // con la Conversions API por servidor si algún día se añade.
    if (tipo === 'clic_comprar') {
      window.fbq?.(
        'track',
        'InitiateCheckout',
        { content_name: 'Plan de Edición Total' },
        detalle?.evento_id ? { eventID: detalle.evento_id } : undefined,
      );
      window.gtag?.('event', 'begin_checkout', { transaction_id: detalle?.evento_id });
    }
  });

  // Clic en WhatsApp: es la conversión principal en la mayoría de landings
  // de servicio, y la que más se olvida de medir.
  document
    .querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"], a[href^="https://api.whatsapp"]')
    .forEach((a) => {
      a.addEventListener('click', () => enviar('clic_whatsapp', { destino: a.href }));
    });

  document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((a) => {
    a.addEventListener('click', () => enviar('clic_telefono'));
  });

  // ── El embudo de esta página ────────────────────────────────────────
  // Sin estos eventos, en GA4 solo se vería "una visita" y "un clic en
  // comprar", sin nada en medio. Con ellos se puede responder lo que de
  // verdad importa para decidir dónde invertir: de cada 100 que entran,
  // cuántos le dan play, cuántos aguantan hasta el pitch y cuántos compran
  // — y de qué anuncio venía cada grupo.
  //
  // Los mismos eventos llegan a Clarity como filtros, así que se puede
  // pasar de "el 60% abandona antes del pitch" a ver las grabaciones de
  // esas sesiones concretas.

  const origen = (): Record<string, string> => {
    const p = new URLSearchParams(location.search);
    return {
      utm_source: p.get('utm_source') ?? '(directo)',
      utm_campaign: p.get('utm_campaign') ?? '(ninguna)',
      utm_content: p.get('utm_content') ?? '(ninguno)',
    };
  };

  document.addEventListener('vsl-arrancado', () => enviar('vsl_play', origen()), { once: true });
  document.addEventListener('pitch-desbloqueado', () => enviar('vsl_llego_al_pitch', origen()), {
    once: true,
  });

  // Hitos del video: los mismos cortes que usa la analítica propia de
  // retención, para poder cruzar una contra otra.
  const video = document.querySelector<HTMLVideoElement>('[data-vsl-video]');
  if (video) {
    const vistos = new Set<number>();
    let midiendo = false;
    document.addEventListener('vsl-arrancado', () => (midiendo = true), { once: true });

    video.addEventListener('timeupdate', () => {
      if (!midiendo || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const pct = Math.floor(((video.currentTime / video.duration) * 100) / 25) * 25;
      if (pct <= 0 || vistos.has(pct)) return;
      vistos.add(pct);
      enviar('vsl_progreso', { porcentaje: pct });
    });

    video.addEventListener('ended', () => {
      if (!midiendo) return;
      enviar('vsl_completo');
    });
  }
}
