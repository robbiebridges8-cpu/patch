-- Reviews tied to an enquiry (one per enquiry); verified only if booked.
-- Applied to remote 2026-07-18.
alter table public.reviews add column if not exists enquiry_id uuid references public.enquiries(id) on delete set null;
create unique index if not exists reviews_enquiry_unique on public.reviews(enquiry_id) where enquiry_id is not null;

create or replace function public.submit_review(p_enquiry_id uuid, p_rating int, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare e_vendor uuid; e_status text; e_date date; e_guests int; r_id uuid;
begin
  select vendor_id, status, party_date, guest_count
    into e_vendor, e_status, e_date, e_guests from enquiries where id = p_enquiry_id;
  if e_vendor is null then raise exception 'enquiry not found'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;
  if exists (select 1 from reviews where enquiry_id = p_enquiry_id) then raise exception 'already reviewed'; end if;
  insert into reviews (vendor_id, enquiry_id, rating, title, body, party_date, guest_count, verified)
  values (e_vendor, p_enquiry_id, p_rating, nullif(trim(p_title),''), nullif(trim(p_body),''),
          e_date, e_guests, e_status = 'booked')
  returning id into r_id;
  return r_id;
end $$;
revoke all on function public.submit_review(uuid, int, text, text) from public;
grant execute on function public.submit_review(uuid, int, text, text) to anon, authenticated;
