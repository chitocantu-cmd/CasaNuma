# Rediseño Casa Numa · septiembre 2026

Sitio público nuevo, construido sobre la identidad del brandbook y el
documento de contenido. Publicado en modo demo (`VITE_FUENTE_DATOS=demo`).

**Fuentes, en orden de prioridad:** `Casa_Numa_Contenido_Webpdf.pdf` →
`CASA NUMA - BRANDBOOK 2.pdf` → boceto del Home → capturas de Membresía →
POT Studio (solo como referencia de experiencia).

---

## 1. Lo que entendimos de la identidad

- **Logo:** «casa» vertical + NU / MA en palo seco geométrico y pesado. La
  **U** es doble: un contorno y un relleno separados por una línea de aire.
  Esa U, girada, es el **arco** que enmarca las fotos principales del sitio.
- **Paleta:** crema `#F5EFE6`, terracota `#B5795E` y café `#602F16` mandan.
  Índigo `#4D57B2` (principal en el brandbook) se usa para foco, estados y
  notas. Naranja, amarillo y verde solo aparecen en las siluetas de piezas.
- **Tipografía:** Ivy Mode para titulares y frases emocionales; Poppins para
  todo lo funcional; Bebas Neue solo en cifras, fechas y precios.
- **Recurso gráfico:** las nueve siluetas de piezas del brandbook (p. 26),
  extraídas en vector exacto — no redibujadas — en
  `src/componentes/marca/trazos.ts`.
- **Personalidad:** manual, cálida, contemporánea. Fotos de manos y barro;
  aplicaciones sobrias con un toque de color.

## 2. Problemas del sitio anterior

- La paleta y las tipografías (Fraunces/Karla, terracota `#C76749`) no eran
  las del brandbook.
- La portada empezaba por la agenda: pedía reservar antes de dar ganas de ir.
- No existían Membresía real (era una lista de espera), NUMA Kids, Eventos,
  NUMA Store, Portafolio ni Mi cuenta.
- No se distinguía qué se paga en línea y qué se cotiza por WhatsApp.
- «Nosotras» estaba escondida dentro de Inicio.

## 3. Qué tomamos de POT Studio

- Servicios claros como puertas de entrada (clases, suscripción, eventos).
- La fotografía como protagonista de cada oferta.
- Un solo botón «Reservar» siempre visible.
- WhatsApp como canal natural para lo que se cotiza.

## 4. Qué NO copiamos

- Su identidad, textos, retícula ni componentes.
- Carrito y tienda con checkout: NUMA Store se compra por WhatsApp.
- Banners de descuento y la jerarquía de e-commerce.
- Imágenes a sangre con texto encima: aquí la composición es editorial,
  asimétrica, con el arco de la U.

## 5. Arquitectura

```
src/
  config/site.ts            TODO dato pendiente (WhatsApp, dirección, mapa…)
  contenido/                textos operativos confirmados, fotos, portafolio,
                            testimonios, navegación, mensajes de WhatsApp
  datos/
    repositorio.ts          contrato: lo único que conocen las páginas
    demo/                   implementación simulada (localStorage)
    hooks.ts                lectura con caché breve
  features/cuenta/          sesión de la clienta
  componentes/
    marca/                  Logo, IconoU, CeramicShape, trazos del brandbook
    base/                   Foto, Boton, Campos, Revelar, Iconos, Pendiente
    reservas/               Calendar, TimeSlot, BookingSummary, CheckoutSteps,
                            PasoCuenta, PasoPago, Confirmacion, CheckoutLayout
    secciones/              Ubicacion, Comunidad
    Header, MobileMenu, Footer, Hero, EditorialGallery, ExperienceCard,
    WorkshopCard, ProductCard, Testimonial, SectionHeading
  paginas/                  una por ruta; el panel sigue en paginas/admin
```

- **React + TypeScript + Vite + Tailwind + Framer Motion** (con `LazyMotion`
  y `m`, respetando «reducir movimiento»).
- **Tokens** en `src/index.css` (variables RGB) y `tailwind.config.ts`:
  colores, escala tipográfica fluida, espaciados de sección, radios (arco,
  U, suave), transiciones. Ningún componente escribe un color suelto.
- **Carga diferida:** la portada va en el bundle principal (117 KB gzip);
  cada página, el checkout y el panel se cargan al entrar. El cliente de
  Supabase solo baja en el panel y en las páginas de pago con Stripe.
- **Datos:** `VITE_FUENTE_DATOS=demo` usa `datos/demo`. El backend real ya
  existe en `supabase/`; lo que falta para conectarlo está en
  [`INTEGRACION.md`](INTEGRACION.md).

## 6. Qué se paga en línea y qué por WhatsApp

| En línea (reserva + pago) | Por WhatsApp (sin pago en línea) |
|---|---|
| Talleres de fin de semana | Eventos especiales (cotización) |
| Membresía NUMA | Compras y encargos de NUMA Store |
| NUMA Kids | |

## 7. Modo demo y producción

- `fuenteDatos = 'demo'`: reservas y pagos **simulados**. Una píldora fija
  («Versión demo · reservas y pagos simulados») lo recuerda en todo momento.
- `mostrarPendientes` (desarrollo, o `VITE_MOSTRAR_PENDIENTES=true`):
  - notas «Pendiente» con lo que falta confirmar;
  - fotos de referencia recortadas del brandbook, con la etiqueta
    «Referencia»;
  - espacios «Testimonio real pendiente».
- Sin esa variable nada de eso se publica: una foto que no existe se dibuja
  como marcador con la silueta NUMA, y una sección sin datos reales se oculta.
  **Hoy producción la tiene activada** (`.env.production`) porque el sitio
  público es la demo; se borra al lanzar con datos y fotos reales.
- Mientras la fuente sea `demo`, todas las páginas llevan `noindex`.
- Cuenta de demostración (membresía a la mitad): `ana@demo.casanuma.mx` ·
  `numa2026`.

## 8. Pendientes de Casa Numa

Nada de esto se inventó; todo vive en `src/config/site.ts` o en
`src/contenido/`:

- WhatsApp oficial y correo. (Instagram confirmado: @casanumamx.)
- Dirección: provisional «Los Aldama 345A» (publicación de octubre); falta
  confirmar la ficha de Google Maps y el horario de atención.
- Agenda: la Semana 1 de octubre ya es real (`src/datos/agenda.ts`). Faltan
  las semanas 2 a 4, el precio de las tardes y clases de cerámica (publicado
  como «Info DM»), el cupo de cada taller y la hora de término de los talleres
  de Halloween.
- Tope de personas por reserva de taller (hoy 6, provisional).
- ¿«Tardes de Cerámica (Niños)» (jueves 5:00 p.m., 10 a 14 años, «Info DM») es
  la sesión de NUMA Kids de esa semana (desde 7 años, $680)? Mientras tanto, la
  agenda manda: ese jueves no se ofrece una sesión de NUMA Kids aparte.
- ¿«Clases de Cerámica» del viernes 10:00 es la sesión de membresía? ¿Y los
  talleres de Halloween del sábado y domingo 11:00 comparten espacio con la
  membresía de esas horas?
- Cupo por sesión de membresía y de NUMA Kids.
- Reglas de reprogramación y vigencia de la membresía.
- Plazo de entrega de piezas.
- Política de reservaciones y cancelaciones, aviso de privacidad, términos.
- Fichas reales de NUMA Store.
- Testimonios reales con permiso.
- Revisión de las biografías con Mónica y Gloria.
- Kit de Adobe Fonts con Ivy Mode (mientras tanto: Noto Serif Display).

## 9. Guion de la sesión de fotos

Cada espacio del sitio está registrado en `src/contenido/fotos.ts`. Para
publicar una foto basta con poner su `src`.

| Espacio | Encuadre |
|---|---|
| inicio-hero | Manos amasando barro sobre mesa manchada, luz natural lateral. Vertical. |
| inicio-hero-mesa | Piezas recién hechas secándose en la mesa del estudio. Horizontal. |
| exp-talleres | Mesa de un taller de fin de semana: esmaltes, pinceles y piezas a medio pintar. Vertical. |
| exp-membresia | Alumna de membresía trabajando su pieza, plano cerrado de manos. Vertical. |
| exp-kids | Niños de 7+ años modelando barro, manos y caras concentradas (con permiso). Vertical. |
| eventos-grupo | Grupo pequeño celebrando alrededor de la mesa larga. Horizontal amplia. |
| hola-estudio | El estudio con luz de mañana: mesa, repisas con piezas, horno al fondo. Vertical. |
| hola-fundadoras | Mónica y Gloria juntas en la mesa de trabajo, sin posar. Horizontal. |
| mapa | Fachada o puerta del estudio. Horizontal. |
| membresia-hero | Alumna modelando una pieza, plano medio. Horizontal amplia. |
| membresia-proyecto-clase | Varias piezas pequeñas, una por clase. Cuadrada. |
| membresia-gran-formato | Pieza de gran formato en proceso. Vertical. |
| taller-tardes-ninos · taller-tardes-adultos · taller-clases · taller-halloween · taller-halloween-pan | Una por taller de la agenda, horizontal 4:3. |
| kids-hero · kids-mesa | Niña o niño con su pieza; la mesa desde arriba. |
| eventos-hero · eventos-detalle | Mesa puesta para evento; varias manos trabajando. |
| store-hero | Repisa con piezas a la venta, fondo limpio. |
| nosotras-hero · nosotras-comunidad | El estudio en un día normal; conversación en clase. |
| retrato-monica · retrato-gloria | Retratos verticales trabajando y recibiendo. |
| cuenta-acceso | Detalle de textura de barro. Vertical. |

Además: 7 piezas del portafolio (`contenido/portafolio.ts`) y las fotos de
cada producto de NUMA Store.
