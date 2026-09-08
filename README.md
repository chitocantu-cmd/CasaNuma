# Casa Numa

Demo del sitio de **Casa Numa** — talleres creativos y cerámica (es-MX).

🔗 **Sitio publicado:** https://chitocantu-cmd.github.io/CasaNuma/

## Qué es esto

Este repo sirve un **build compilado** de la app (Vite + React) como sitio estático.
`index.html` es el bundle de un solo archivo: JS y CSS van minificados en línea.

- `index.html` — el demo completo
- `404.html` — copia idéntica de `index.html`; permite que las rutas
  del SPA (`/talleres`, `/membresia`, …) funcionen al entrar directo o recargar,
  ya que GitHub Pages devuelve `404.html` en rutas que no existen como archivo
- `.nojekyll` — evita que Jekyll filtre archivos

## Contenido de la app

- **Rutas:** `/talleres`, `/membresia`, `/nosotras`, `/contacto`
- **11 talleres** con página propia: cerámica desde cero, torno por primera vez,
  noche de barro, day pass, acuarela botánica, esmaltes y color, entre otros
- **Flujo de reserva** con exportación a calendario (`.ics`)
- **Pagos y correos en modo demo** — no hay cobro ni envío real

## Limitaciones conocidas

Cosas por resolver antes de considerarlo producción:

1. **Las imágenes no se muestran.** El bundle referencia 36 archivos en
   `/images/...` que no están en el repo. Además, al servirse bajo la subruta
   `/CasaNuma/`, esas rutas absolutas apuntarían fuera del sitio. Para arreglarlo
   hay que subir las imágenes a `images/` y reescribir las rutas del bundle a
   `/CasaNuma/images/...`.
2. **No hay código fuente.** Solo está el build minificado, así que el sitio no
   es editable de forma práctica. Para desarrollarlo hay que reconstruir el
   proyecto Vite + React.
3. **Pagos y notificaciones son simulados.** El servicio de correo escribe en la
   consola del navegador; el pago siempre se aprueba en modo `demo`.
