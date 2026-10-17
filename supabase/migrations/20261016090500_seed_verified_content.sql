-- Orange Salon — verified production content.
--
-- Only details confirmed by the salon are seeded here:
--   phone +251 91 241 9748, address Ednamoll Street (Addis Ababa), opening hours,
--   and genuine photographs and reels of work done at the salon.
-- Services, prices, stylists, reviews and social links are intentionally NOT
-- seeded; the owner enters them in /admin. Development-only demo data lives in
-- supabase/seed.demo.sql and must never be run against production.

insert into public.business_settings (
  id, name, tagline, phone, address_line, city, country_code, policy_text
) values (
  1,
  'Orange Salon',
  'Your Hair. Your Style. Your Confidence.',
  '+251912419748',
  'Ednamoll Street',
  'Addis Ababa',
  'ET',
  'Online bookings are requests until our team confirms them. Please arrive a few minutes early. '
  || 'If you need to cancel or move your appointment, please do so at least 12 hours beforehand '
  || 'using your booking reference, or call us. Payment is taken at the salon.'
)
on conflict (id) do nothing;

insert into public.notification_settings (id) values (1) on conflict (id) do nothing;

-- 0 = Sunday. Mon–Sat 08:00–20:00, Sun 09:00–19:30.
insert into public.business_hours (weekday, is_closed, opens_at, closes_at) values
  (0, false, '09:00', '19:30'),
  (1, false, '08:00', '20:00'),
  (2, false, '08:00', '20:00'),
  (3, false, '08:00', '20:00'),
  (4, false, '08:00', '20:00'),
  (5, false, '08:00', '20:00'),
  (6, false, '08:00', '20:00')
on conflict (weekday) do nothing;

-- Genuine salon work, shipped with the site under /public.
insert into public.gallery_items
  (media_type, media_path, poster_path, caption, alt_text, category, source, width, height, is_featured, sort_order)
values
  ('image', '/images/gallery/copper-passion-twists.jpg', null,
   'Copper passion twists',
   'Back view of long two-tone passion twists, black at the root fading to copper, in the Orange Salon lounge',
   'braids', 'salon', 962, 1454, true, 10),
  ('image', '/images/gallery/burgundy-waves-highlights.jpg', null,
   'Burgundy waves with face-framing highlights',
   'Client with shoulder-length burgundy waves and silver face-framing highlights',
   'colour', 'salon', 724, 1600, true, 20),
  ('image', '/images/gallery/stitch-braids-curly-ponytail.jpg', null,
   'Stitch braids into a curly ponytail',
   'Side view of neat stitch braids swept into a voluminous curly ponytail',
   'braids', 'salon', 1500, 2000, true, 30),
  ('image', '/images/gallery/blonde-spiral-curls.jpg', null,
   'Spiral curls with blonde highlights',
   'Back view of defined spiral curls through highlighted blonde hair',
   'styling', 'salon', 1024, 1536, true, 40),
  ('image', '/images/gallery/balayage-waves.jpg', null,
   'Soft balayage waves',
   'Back view of a shoulder-length cut with honey balayage and soft waves',
   'colour', 'salon', 1024, 1536, false, 50),
  ('image', '/images/gallery/two-strand-twists.jpg', null,
   'Two-strand twists',
   'Top-down view of two-strand twists with clean triangular parts',
   'braids', 'salon', 1086, 1448, false, 60),
  ('image', '/images/gallery/burgundy-waves-neon-sign.jpg', null,
   'Burgundy colour under the Orange Salon sign',
   'Client with burgundy waves seated in front of the illuminated Orange Salon neon sign',
   'colour', 'salon', 960, 1600, false, 70),
  ('image', '/images/gallery/stylist-at-work.jpg', null,
   'In the chair at Orange Salon',
   'Stylist smiling while styling a client''s long straight hair inside Orange Salon',
   'styling', 'salon', 1510, 1536, false, 80),
  ('video', '/videos/gallery/copper-bob-colour.mp4', '/videos/gallery/copper-bob-colour-poster.jpg',
   'Copper bob colour',
   'Short video of a glossy copper-red bob being shown from different angles',
   'colour', 'salon', 540, 960, false, 90),
  ('video', '/videos/gallery/knotless-braids-two-tone.mp4', '/videos/gallery/knotless-braids-two-tone-poster.jpg',
   'Two-tone knotless braids',
   'Short video of shoulder-length knotless braids in black and honey blonde',
   'braids', 'salon', 540, 960, false, 100),
  ('video', '/videos/gallery/cornrows-with-natural-volume.mp4', '/videos/gallery/cornrows-with-natural-volume-poster.jpg',
   'Cornrows with natural volume',
   'Short video of fine front cornrows leading into full natural curls',
   'braids', 'salon', 540, 960, false, 110);
