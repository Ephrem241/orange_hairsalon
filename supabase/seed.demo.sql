-- ⚠️  DEMO DATA — DEVELOPMENT AND DEMO PROJECTS ONLY. NEVER RUN AGAINST PRODUCTION.
--
-- Fills an empty development database with an illustrative menu and team so the
-- booking flow and dashboard can be exercised end to end. Every row is flagged
-- `is_demo = true`; prices and names are placeholders, not Orange Salon's real
-- menu. The public site shows a "Demo" badge on these rows.
--
-- Remove everything this file created:
--   delete from public.appointments where is_demo or service_id in (select id from public.services where is_demo);
--   delete from public.stylists where is_demo;
--   delete from public.services where is_demo;
--   delete from public.service_categories where is_demo;
--   delete from public.customers where is_demo;

insert into public.service_categories (slug, name, description, sort_order, is_demo) values
  ('braids', 'Braids & Protective Styles', 'Knotless braids, twists and cornrows.', 10, true),
  ('colour', 'Colour', 'Full colour, highlights and balayage.', 20, true),
  ('cuts-styling', 'Cuts & Styling', 'Cuts, blow-dries and finishing.', 30, true),
  ('treatments', 'Treatments', 'Repair and moisture treatments.', 40, true),
  ('bridal', 'Bridal & Events', 'Styling for weddings and special occasions.', 50, true)
on conflict (slug) do nothing;

insert into public.services
  (category_id, slug, name, summary, description, image_path, price_etb, price_type, duration_min, buffer_min, is_featured, sort_order, is_demo)
select c.id, s.slug, s.name, s.summary, s.description, s.image_path, s.price_etb, s.price_type, s.duration_min, s.buffer_min, s.is_featured, s.sort_order, true
from (values
  ('braids', 'demo-knotless-braids', 'Knotless Braids (demo)', 'Lightweight, natural-looking braids.',
   'Illustrative demo service. Real menu, pricing and timings are set by the salon in the dashboard.',
   '/images/gallery/copper-passion-twists.jpg', 4500, 'from', 240, 15, true, 10),
  ('braids', 'demo-stitch-braids', 'Stitch Braids (demo)', 'Clean, defined cornrow patterns.',
   'Illustrative demo service.', '/images/gallery/stitch-braids-curly-ponytail.jpg', 3000, 'from', 150, 15, true, 20),
  ('colour', 'demo-colour-highlights', 'Colour & Highlights (demo)', 'Dimensional colour, tailored to you.',
   'Illustrative demo service.', '/images/gallery/burgundy-waves-highlights.jpg', 3500, 'from', 180, 15, true, 30),
  ('colour', 'demo-balayage', 'Balayage (demo)', 'Soft, sun-kissed colour.',
   'Illustrative demo service.', '/images/gallery/balayage-waves.jpg', 5000, 'from', 210, 15, false, 40),
  ('cuts-styling', 'demo-curls-styling', 'Curls & Styling (demo)', 'Defined curls for any occasion.',
   'Illustrative demo service.', '/images/gallery/blonde-spiral-curls.jpg', 1200, 'fixed', 75, 10, true, 50),
  ('cuts-styling', 'demo-silk-press', 'Silk Press (demo)', 'Smooth, glossy and swingy.',
   'Illustrative demo service.', '/images/gallery/stylist-at-work.jpg', 1500, 'fixed', 90, 10, false, 60),
  ('treatments', 'demo-deep-treatment', 'Deep Treatment (demo)', 'Nourish, repair and restore.',
   'Illustrative demo service.', null, 900, 'fixed', 45, 10, false, 70),
  ('bridal', 'demo-bridal-styling', 'Bridal Styling (demo)', 'Elegant styling for your day.',
   'Illustrative demo service.', null, 6000, 'from', 180, 30, true, 80)
) as s (category, slug, name, summary, description, image_path, price_etb, price_type, duration_min, buffer_min, is_featured, sort_order)
join public.service_categories c on c.slug = s.category
on conflict (slug) do nothing;

insert into public.stylists (slug, display_name, title, bio, sort_order, is_demo) values
  ('demo-stylist-one', 'Stylist One (demo)', 'Braids specialist', 'Placeholder profile for development.', 10, true),
  ('demo-stylist-two', 'Stylist Two (demo)', 'Colour specialist', 'Placeholder profile for development.', 20, true),
  ('demo-stylist-three', 'Stylist Three (demo)', 'Stylist', 'Placeholder profile for development.', 30, true)
on conflict (slug) do nothing;

-- Who does what.
insert into public.stylist_services (stylist_id, service_id)
select st.id, sv.id
from public.stylists st
join public.services sv on sv.is_demo
where st.slug = 'demo-stylist-one' and sv.slug in ('demo-knotless-braids', 'demo-stitch-braids', 'demo-curls-styling', 'demo-bridal-styling')
   or st.slug = 'demo-stylist-two' and sv.slug in ('demo-colour-highlights', 'demo-balayage', 'demo-silk-press', 'demo-deep-treatment')
   or st.slug = 'demo-stylist-three' and sv.is_demo
on conflict do nothing;

-- Mon–Sat 08:00–20:00 with lunch 13:00–14:00; stylist three also works Sundays.
insert into public.working_hours (stylist_id, weekday, starts_at, ends_at)
select st.id, d, '08:00'::time, '20:00'::time
from public.stylists st cross join generate_series(1, 6) as d
where st.is_demo
union all
select st.id, 0, '09:00'::time, '19:30'::time
from public.stylists st where st.slug = 'demo-stylist-three';

insert into public.stylist_breaks (stylist_id, weekday, starts_at, ends_at, label)
select st.id, d, '13:00'::time, '14:00'::time, 'Lunch'
from public.stylists st cross join generate_series(1, 6) as d
where st.is_demo;
