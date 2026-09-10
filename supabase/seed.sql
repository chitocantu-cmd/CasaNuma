-- ============================================================================
-- Casa Numa · Datos iniciales
-- ----------------------------------------------------------------------------
-- Los 11 talleres reales, extraidos del bundle original (commit 140ca86) y
-- migrados al esquema nuevo. En el demo todo esto estaba escrito a mano
-- dentro del JavaScript; aqui son datos, editables desde el panel.
--
-- Conversiones: status 'publicado' -> 'published' | image -> image_url
-- price 0 -> booking_mode 'quote' (no entra al flujo de pago)
-- duration -> eliminado (se deriva de start_time/end_time)
--
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================================

insert into workshops (
  slug, title, category, short_description, description,
  date, start_time, end_time, timezone, price, currency, capacity,
  location, instructor, level, includes, crearas, faqs,
  image_url, gallery, tono, booking_mode, status
) values
  (
    'ceramica-desde-cero', 'Cerámica desde cero', 'ceramica',
    'Una experiencia para aprender, ensuciarte las manos y crear tu primera pieza.',
    array['Empezamos por lo básico: sentir el barro, entender cómo responde y perderle el miedo. No necesitas experiencia ni haber tocado arcilla antes.', 'Trabajamos con técnicas de modelado a mano —pellizco, churro y placa— para que salgas con una pieza terminada y con ganas de volver por la siguiente.']::text[],
    '2026-09-12', '11:00', '13:30', 'America/Monterrey',
    650.00, 'MXN', 12,
    'Casa Numa', '[Nombre] — Fundadora', 'Principiante',
    array['Arcilla y herramientas', 'Delantal', 'Quema y esmaltado', 'Café y algo dulce']::text[],
    array['Un tazón o vaso modelado a mano', 'Una pieza pequeña de práctica']::text[],
    '[{"q":"¿Necesito experiencia?","a":"Ninguna. El taller está pensado para primeras veces."},{"q":"¿Cuándo me llevo mi pieza?","a":"Después de quema y esmaltado, alrededor de tres semanas. Te avisamos por WhatsApp."},{"q":"¿Cómo pago?","a":"Puedes pagar tu lugar en línea al momento de reservar. Tu reservación queda confirmada una vez que el pago ha sido aprobado."}]'::jsonb,
    '/images/talleres/ceramica-desde-cero.jpg',
    array['/images/talleres/ceramica-desde-cero-1.jpg', '/images/talleres/ceramica-desde-cero-2.jpg', '/images/talleres/ceramica-desde-cero-3.jpg']::text[],
    'terracota', 'paid', 'published'
  ),
  (
    'pinta-tu-propia-pieza', 'Pinta tu propia pieza', 'pintura',
    'Eliges una pieza en bizcocho y la haces tuya con color.',
    array['Una tarde tranquila, sin prisa. Escoges una pieza ya horneada y la pintas como quieras: con plantilla, a mano suelta o copiando algo que traigas guardado en el celular.', 'Es el taller ideal para venir acompañada, platicar y salir con algo hecho por ti.']::text[],
    '2026-09-14', '16:00', '18:00', 'America/Monterrey',
    550.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Talleres', 'Todos los niveles',
    array['Pieza en bizcocho a elegir', 'Esmaltes y pinceles', 'Quema final']::text[],
    array['Una pieza pintada por completo', 'Un diseño propio sobre cerámica']::text[],
    '[{"q":"¿Puedo elegir qué pieza pintar?","a":"Sí, tenemos tazas, platos y macetas pequeñas disponibles el día del taller."},{"q":"¿Puedo venir con alguien?","a":"Claro. Puedes reservar y pagar varios lugares en la misma operación."}]'::jsonb,
    '/images/talleres/pinta-tu-propia-pieza.jpg',
    array['/images/talleres/pinta-tu-propia-pieza-1.jpg', '/images/talleres/pinta-tu-propia-pieza-2.jpg']::text[],
    'azul', 'paid', 'published'
  ),
  (
    'ceramica-tematica-septiembre', 'Cerámica temática', 'especiales',
    'Cada mes cambiamos de tema. Este mes: vajilla de mesa mexicana.',
    array['Una sesión con tema fijo que cambia cada mes. Trabajamos una sola idea a fondo, con referencias, molde y color pensados para ese tema.', 'Se llena rápido: los lugares se abren el primer día del mes.']::text[],
    '2026-09-21', '11:00', '14:00', 'America/Monterrey',
    780.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Fundadora', 'Todos los niveles',
    array['Materiales del tema del mes', 'Quema y esmaltado', 'Comida ligera']::text[],
    array['Dos piezas de vajilla coordinadas']::text[],
    '[{"q":"¿Cuándo abren lugares nuevos?","a":"El primer día de cada mes anunciamos el tema y liberamos lugares en Instagram."}]'::jsonb,
    '/images/talleres/ceramica-tematica.jpg',
    array['/images/talleres/ceramica-tematica-1.jpg', '/images/talleres/ceramica-tematica-2.jpg']::text[],
    'olivo', 'paid', 'published'
  ),
  (
    'taller-libre-sabado', 'Taller libre', 'libre',
    'El estudio abierto: tú traes la idea, nosotras el barro y las herramientas.',
    array['Sin instrucción guiada. Reservas mesa, tomas materiales y trabajas a tu ritmo. Siempre hay alguien del estudio cerca por si te atoras.', 'Pensado para quienes ya tomaron un taller y quieren seguir practicando.']::text[],
    '2026-09-26', '10:00', '14:00', 'America/Monterrey',
    420.00, 'MXN', 8,
    'Casa Numa', 'Estudio abierto', 'Intermedio',
    array['Mesa de trabajo', 'Herramientas del estudio', 'Arcilla por kilo (se cobra aparte)']::text[],
    array['Lo que traigas en mente']::text[],
    '[{"q":"¿Puedo venir si es mi primera vez?","a":"Te recomendamos empezar por “Cerámica desde cero”. El taller libre no tiene instrucción guiada."}]'::jsonb,
    '/images/talleres/taller-libre.jpg',
    array['/images/talleres/taller-libre-1.jpg']::text[],
    'tinta', 'paid', 'published'
  ),
  (
    'day-pass-estudio', 'Day pass', 'libre',
    'Un día completo en el estudio, con todo incluido.',
    array['Llegas en la mañana y te vas cuando cerramos. Acceso a mesas, torno de práctica y materiales básicos.', 'Un buen plan para un día libre, sola o acompañada.']::text[],
    '2026-10-03', '10:00', '18:00', 'America/Monterrey',
    890.00, 'MXN', 6,
    'Casa Numa', 'Estudio abierto', 'Todos los niveles',
    array['Acceso todo el día', 'Materiales básicos', 'Café y comida ligera']::text[],
    array['Todas las piezas que alcances a terminar']::text[],
    '[{"q":"¿Puedo salir y volver?","a":"Sí, tu lugar se queda apartado todo el día."}]'::jsonb,
    '/images/talleres/day-pass.jpg',
    array['/images/talleres/day-pass-1.jpg']::text[],
    'arcilla', 'paid', 'published'
  ),
  (
    'torno-primera-vez', 'Torno por primera vez', 'ceramica',
    'Centrar, abrir y levantar. Dos horas frente al torno.',
    array['El torno intimida hasta que lo tocas. En esta sesión trabajas con tu propio torno durante toda la clase, en grupos muy pequeños.', 'Salimos con al menos una pieza levantada por ti.']::text[],
    '2026-10-10', '11:00', '13:00', 'America/Monterrey',
    720.00, 'MXN', 6,
    'Casa Numa', '[Nombre] — Fundadora', 'Principiante',
    array['Torno individual', 'Arcilla', 'Quema y esmaltado']::text[],
    array['Un cilindro o tazón levantado en torno']::text[],
    '[{"q":"¿Qué ropa llevo?","a":"Ropa que puedas ensuciar. El barro sale con agua, pero mejor no estrenar nada."}]'::jsonb,
    '/images/talleres/torno.jpg',
    array['/images/talleres/torno-1.jpg', '/images/talleres/torno-2.jpg']::text[],
    'terracota', 'paid', 'published'
  ),
  (
    'piezas-personalizadas', 'Piezas personalizadas', 'especiales',
    'Diseñamos contigo una pieza para un regalo, una boda o tu casa.',
    array['Una sesión de trabajo para definir forma, color y cantidad. De ahí sale un presupuesto y un calendario de producción.', 'Sirve igual para un juego de tazas de regalo que para la vajilla de un restaurante.']::text[],
    '2026-10-17', '12:00', '13:30', 'America/Monterrey',
    0.00, 'MXN', 4,
    'Casa Numa', '[Nombre] — Fundadora', 'Todos los niveles',
    array['Sesión de diseño', 'Muestrario de esmaltes', 'Presupuesto por escrito']::text[],
    array['El boceto y la ficha técnica de tu encargo']::text[],
    '[{"q":"¿La sesión tiene costo?","a":"La sesión de diseño no se cobra. La producción se cotiza según la pieza."}]'::jsonb,
    '/images/talleres/personalizadas.jpg',
    array['/images/talleres/personalizadas-1.jpg']::text[],
    'olivo', 'quote', 'published'
  ),
  (
    'acuarela-botanica', 'Acuarela botánica', 'pintura',
    'Papel, agua y plantas del patio. Una mañana lenta.',
    array['Cambiamos el barro por el papel. Aprendemos aguadas, transparencias y cómo dejar que el agua haga su parte.', 'Trabajamos observando plantas reales, no fotos.']::text[],
    '2026-10-24', '10:30', '13:00', 'America/Monterrey',
    590.00, 'MXN', 12,
    'Casa Numa', '[Nombre invitada]', 'Principiante',
    array['Papel de algodón', 'Acuarelas y pinceles', 'Café de olla']::text[],
    array['Tres láminas botánicas']::text[],
    '[{"q":"¿Puedo llevar mis materiales?","a":"Si ya tienes pinceles favoritos, tráelos. Lo demás lo ponemos nosotras."}]'::jsonb,
    '/images/talleres/acuarela.jpg',
    array['/images/talleres/acuarela-1.jpg']::text[],
    'azul', 'paid', 'published'
  ),
  (
    'esmaltes-y-color', 'Esmaltes y color', 'ceramica',
    'Cómo se comporta el color en el horno y por qué a veces sorprende.',
    array['Un taller para quienes ya modelan y quieren entender el esmalte: capas, superposiciones y pruebas.', 'Hacemos una tabla de muestras que te llevas para tus siguientes piezas.']::text[],
    '2026-11-07', '11:00', '14:00', 'America/Monterrey',
    690.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Fundadora', 'Intermedio',
    array['Piezas de prueba', 'Esmaltes del estudio', 'Tabla de muestras para llevar']::text[],
    array['Una tabla de esmaltes propia', 'Dos piezas esmaltadas']::text[],
    '[{"q":"¿Necesito traer piezas?","a":"No, nosotras ponemos las piezas de prueba."}]'::jsonb,
    '/images/talleres/esmaltes.jpg',
    array['/images/talleres/esmaltes-1.jpg']::text[],
    'arcilla', 'paid', 'published'
  ),
  (
    'noche-de-barro', 'Noche de barro', 'especiales',
    'Entre semana, después del trabajo, con música y vino.',
    array['Abrimos el estudio de noche una vez al mes. Modelado libre, playlist larga y una copa incluida.', 'Es más plan social que clase, pero siempre sale algo.']::text[],
    '2026-11-13', '19:00', '22:00', 'America/Monterrey',
    640.00, 'MXN', 16,
    'Casa Numa', 'Equipo Casa Numa', 'Todos los niveles',
    array['Arcilla y herramientas', 'Una copa', 'Snacks']::text[],
    array['Una pieza libre']::text[],
    '[{"q":"¿Es solo para mayores de edad?","a":"Sí, por la bebida incluida. Hay opción sin alcohol."}]'::jsonb,
    '/images/talleres/noche-de-barro.jpg',
    array['/images/talleres/noche-de-barro-1.jpg']::text[],
    'tinta', 'paid', 'published'
  ),
  (
    'taller-libre-noviembre', 'Taller libre', 'libre',
    'El estudio abierto: tú traes la idea, nosotras el barro.',
    array['Misma dinámica del taller libre: mesa, herramientas y tu ritmo.']::text[],
    '2026-11-21', '10:00', '14:00', 'America/Monterrey',
    420.00, 'MXN', 8,
    'Casa Numa', 'Estudio abierto', 'Intermedio',
    array['Mesa de trabajo', 'Herramientas del estudio']::text[],
    array['Lo que traigas en mente']::text[],
    '[{"q":"¿Hay que reservar?","a":"Sí, los lugares son limitados por mesa."}]'::jsonb,
    '/images/talleres/taller-libre-nov.jpg',
    '{}',
    'olivo', 'paid', 'published'
  )
on conflict (slug) do update set
  title              = excluded.title,
  category           = excluded.category,
  short_description  = excluded.short_description,
  description        = excluded.description,
  date               = excluded.date,
  start_time         = excluded.start_time,
  end_time           = excluded.end_time,
  timezone           = excluded.timezone,
  price              = excluded.price,
  capacity           = excluded.capacity,
  location           = excluded.location,
  instructor         = excluded.instructor,
  level              = excluded.level,
  includes           = excluded.includes,
  crearas            = excluded.crearas,
  faqs               = excluded.faqs,
  image_url          = excluded.image_url,
  gallery            = excluded.gallery,
  tono               = excluded.tono,
  booking_mode       = excluded.booking_mode;

-- ============================================================================
-- Ocupacion de demostracion  ·  OPCIONAL — BORRAR ANTES DE PRODUCCION
-- ----------------------------------------------------------------------------
-- Reproduce los contadores que el demo tenia escritos a mano, para que:
--   1. El sitio se vea igual que el demo original.
--   2. Haya datos para probar el cupo de inmediato:
--      · noche-de-barro        -> 14/16, quedan 2  (TEST C: concurrencia)
--      · ceramica-tematica-... -> 10/10, lleno     (TEST B: rechazo)
--
-- Se reparte en reservas de 1 a 3 personas porque quantity tiene un CHECK
-- de 1 a 10, y porque asi se parece a la realidad.
-- ============================================================================

insert into customers (full_name, email, phone) values
  ('María Fernanda G.', 'demo1@casanuma.local', '+528180001000'),
  ('Ana Sofía R.', 'demo2@casanuma.local', '+528180001001'),
  ('Regina M.', 'demo3@casanuma.local', '+528180001002'),
  ('Paulina T.', 'demo4@casanuma.local', '+528180001003'),
  ('Valeria C.', 'demo5@casanuma.local', '+528180001004'),
  ('Daniela H.', 'demo6@casanuma.local', '+528180001005'),
  ('Ximena L.', 'demo7@casanuma.local', '+528180001006'),
  ('Andrea P.', 'demo8@casanuma.local', '+528180001007'),
  ('Camila S.', 'demo9@casanuma.local', '+528180001008'),
  ('Renata V.', 'demo10@casanuma.local', '+528180001009'),
  ('Fernanda O.', 'demo11@casanuma.local', '+528180001010'),
  ('Mariana B.', 'demo12@casanuma.local', '+528180001011')
on conflict (email) do nothing;

insert into reservations (
  reservation_code, workshop_id, customer_id, quantity,
  unit_price, total_amount, currency, status, confirmed_at, notes
)
select
  'NUMA-' || upper(substr(md5(d.slug || d.idx::text), 1, 6)),
  w.id, c.id, d.n,
  w.price, w.price * d.n, 'MXN', 'confirmed',
  now() - (d.idx || ' hours')::interval,
  'Ocupacion heredada del demo. Borrar antes de produccion.'
from (values
  ('ceramica-desde-cero', 'demo1@casanuma.local', 2, 0),
  ('ceramica-desde-cero', 'demo2@casanuma.local', 1, 1),
  ('ceramica-desde-cero', 'demo3@casanuma.local', 1, 2),
  ('pinta-tu-propia-pieza', 'demo1@casanuma.local', 2, 0),
  ('pinta-tu-propia-pieza', 'demo2@casanuma.local', 1, 1),
  ('pinta-tu-propia-pieza', 'demo3@casanuma.local', 3, 2),
  ('pinta-tu-propia-pieza', 'demo4@casanuma.local', 1, 3),
  ('ceramica-tematica-septiembre', 'demo1@casanuma.local', 2, 0),
  ('ceramica-tematica-septiembre', 'demo2@casanuma.local', 1, 1),
  ('ceramica-tematica-septiembre', 'demo3@casanuma.local', 3, 2),
  ('ceramica-tematica-septiembre', 'demo4@casanuma.local', 2, 3),
  ('ceramica-tematica-septiembre', 'demo5@casanuma.local', 1, 4),
  ('ceramica-tematica-septiembre', 'demo6@casanuma.local', 1, 5),
  ('taller-libre-sabado', 'demo1@casanuma.local', 2, 0),
  ('taller-libre-sabado', 'demo2@casanuma.local', 1, 1),
  ('taller-libre-sabado', 'demo3@casanuma.local', 2, 2),
  ('day-pass-estudio', 'demo1@casanuma.local', 2, 0),
  ('torno-primera-vez', 'demo1@casanuma.local', 2, 0),
  ('torno-primera-vez', 'demo2@casanuma.local', 1, 1),
  ('acuarela-botanica', 'demo1@casanuma.local', 2, 0),
  ('acuarela-botanica', 'demo2@casanuma.local', 1, 1),
  ('acuarela-botanica', 'demo3@casanuma.local', 3, 2),
  ('acuarela-botanica', 'demo4@casanuma.local', 2, 3),
  ('acuarela-botanica', 'demo5@casanuma.local', 1, 4),
  ('esmaltes-y-color', 'demo1@casanuma.local', 2, 0),
  ('noche-de-barro', 'demo1@casanuma.local', 2, 0),
  ('noche-de-barro', 'demo2@casanuma.local', 1, 1),
  ('noche-de-barro', 'demo3@casanuma.local', 3, 2),
  ('noche-de-barro', 'demo4@casanuma.local', 2, 3),
  ('noche-de-barro', 'demo5@casanuma.local', 1, 4),
  ('noche-de-barro', 'demo6@casanuma.local', 2, 5),
  ('noche-de-barro', 'demo7@casanuma.local', 3, 6)
) as d(slug, email, n, idx)
join workshops w on w.slug = d.slug
join customers c on c.email = d.email
on conflict (reservation_code) do nothing;
