import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { enlaceInstagram, fuenteDatos, siteConfig } from '../config/site';

// ---------------------------------------------------------------------------
// SEO por página: title, description, OpenGraph, canonical y JSON-LD.
// ---------------------------------------------------------------------------
// El JSON-LD (LocalBusiness, Event, Product) solo se publica con datos
// definitivos: un Event con precio de demostración sería información falsa
// para Google. Los constructores devuelven null mientras falte algo.
// ---------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

function meta(selector: string, atributo: 'name' | 'property', valor: string, contenido: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(atributo, valor);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenido);
}

export function useSeo({
  titulo,
  descripcion,
  jsonLd,
  indexar = true,
}: {
  /** Título completo, tal como debe verse en Google. */
  titulo: string;
  descripcion: string;
  jsonLd?: JsonLd | JsonLd[] | null;
  indexar?: boolean;
}) {
  const { pathname } = useLocation();
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    document.title = titulo;
    meta('meta[name="description"]', 'name', 'description', descripcion);
    meta('meta[property="og:title"]', 'property', 'og:title', titulo);
    meta('meta[property="og:description"]', 'property', 'og:description', descripcion);
    // La demo (pagos simulados, cupos y productos de ejemplo) no se indexa.
    const publicable = indexar && fuenteDatos !== 'demo';
    meta('meta[name="robots"]', 'name', 'robots', publicable ? 'index, follow' : 'noindex, nofollow');

    if (siteConfig.url) {
      const url = `${siteConfig.url}${pathname}`;
      meta('meta[property="og:url"]', 'property', 'og:url', url);
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    const previo = document.getElementById('jsonld-pagina');
    previo?.remove();
    if (ld) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.id = 'jsonld-pagina';
      s.textContent = ld;
      document.head.appendChild(s);
    }
  }, [titulo, descripcion, ld, indexar, pathname]);
}

/** LocalBusiness: solo con dirección confirmada. */
export function ldNegocio(): JsonLd | null {
  if (!siteConfig.direccion) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: siteConfig.nombre,
    description: 'Estudio de cerámica: talleres, membresía, NUMA Kids, eventos privados y piezas hechas a mano.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.direccion,
      postalCode: siteConfig.codigoPostal,
      addressLocality: 'San Pedro Garza García',
      addressRegion: 'Nuevo León',
      addressCountry: 'MX',
    },
    ...(siteConfig.url ? { url: siteConfig.url } : {}),
    ...(enlaceInstagram() ? { sameAs: [enlaceInstagram()] } : {}),
    ...(siteConfig.whatsapp ? { telephone: `+${siteConfig.whatsapp.replace(/\D/g, '')}` } : {}),
  };
}

/** Event: solo para talleres con datos definitivos y dirección confirmada. */
export function ldEvento(e: {
  nombre: string; descripcion: string; fecha: string; inicio: string; fin: string | null;
  precio: number | null; agotado: boolean; demo: boolean;
}): JsonLd | null {
  if (e.demo || !siteConfig.direccion) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.nombre,
    description: e.descripcion,
    startDate: `${e.fecha}T${e.inicio}:00-06:00`,
    ...(e.fin ? { endDate: `${e.fecha}T${e.fin}:00-06:00` } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: siteConfig.nombre, address: `${siteConfig.direccion}, ${siteConfig.zona}` },
    // Sin precio publicado no se declara oferta: sería un precio inventado.
    ...(e.precio !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: e.precio,
            priceCurrency: 'MXN',
            availability: e.agotado ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

/** Product: solo fichas reales con precio publicado. */
export function ldProducto(p: {
  nombre: string; descripcion: string; precio: number | null; agotado: boolean; demo: boolean;
}): JsonLd | null {
  if (p.demo || p.precio === null) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    description: p.descripcion,
    brand: { '@type': 'Brand', name: siteConfig.nombre },
    offers: {
      '@type': 'Offer',
      price: p.precio,
      priceCurrency: 'MXN',
      availability: p.agotado ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  };
}
