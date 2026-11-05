-- FICTIONAL SEED DATA for the QuietTip prototype.
-- The cafe, receipts, items, and pooling policy are invented. Each receipt represents a
-- purchase that is already paid; no real customer or payment data is involved.
-- Receipt access tokens are generated randomly by the database, so they differ per project.
-- Print the links with:  npm run receipts:links

insert into public.cafes (slug, name, employee_count, starting_pool_cents, policy_text)
values (
  'juniper-lane',
  'Juniper Lane Cafe',
  4,
  4000,
  'All tips go to the employee pool. For this demonstration, pooled tips are divided equally among four employees who worked this shift. The business keeps none.'
)
on conflict (slug) do nothing;

insert into public.receipts (cafe_id, reference, purchased_at, items, subtotal_cents, tax_cents, total_cents)
select c.id, v.reference, v.purchased_at::timestamptz, v.items::jsonb, v.subtotal, v.tax, v.subtotal + v.tax
from public.cafes c
cross join (values
  ('JL-1042', '2026-11-03 08:42:00-05',
   '[{"name":"Oat latte","qty":1,"cents":450},{"name":"Turkey sandwich","qty":1,"cents":1100},{"name":"Blueberry muffin","qty":1,"cents":300}]',
   1850, 150),
  ('JL-1043', '2026-11-03 09:15:00-05',
   '[{"name":"Drip coffee","qty":2,"cents":600},{"name":"Almond croissant","qty":1,"cents":425}]',
   1025, 82),
  ('JL-1044', '2026-11-03 12:30:00-05',
   '[{"name":"Tomato soup","qty":1,"cents":750},{"name":"Iced tea","qty":1,"cents":325}]',
   1075, 86)
) as v(reference, purchased_at, items, subtotal, tax)
where c.slug = 'juniper-lane'
on conflict (cafe_id, reference) do nothing;
