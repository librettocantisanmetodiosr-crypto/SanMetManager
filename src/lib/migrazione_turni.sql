-- ═══════════════════════════════════════════════════
-- TURNI LITURGICI — letture e offertorio del sabato
--
-- Piano mensile generato a rotazione fra i catechisti che partecipano,
-- rivisto e approvato dai responsabili, poi visibile a tutti.
-- Solo aggiunte: non modifica ne' cancella nulla di esistente.
-- ═══════════════════════════════════════════════════

-- ── Chi partecipa ai turni e chi li gestisce ──────────────────
alter table public.profili add column if not exists partecipa_turni boolean default false;
alter table public.profili add column if not exists gestisce_turni  boolean default false;

-- ── Piano mensile ─────────────────────────────────────────────
create table if not exists public.piani_turni (
  id uuid default uuid_generate_v4() primary key,
  anno int not null,
  mese int not null,                       -- 1-12
  stato text not null default 'bozza',     -- bozza | approvato
  approvato_da uuid references public.profili(id) on delete set null,
  approvato_at timestamptz,
  creato_da uuid references public.profili(id) on delete set null,
  created_at timestamptz default now(),
  unique(anno, mese)
);

-- ── Singolo incarico ──────────────────────────────────────────
create table if not exists public.turni (
  id uuid default uuid_generate_v4() primary key,
  piano_id uuid references public.piani_turni(id) on delete cascade,
  data_id uuid references public.date_catechismo(id) on delete cascade,
  ruolo text not null,                     -- prima_lettura | salmo | seconda_lettura | offertorio
  posizione int default 1,                 -- 1 o 2 per i due dell'offertorio
  profilo_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_turni_piano on public.turni(piano_id);
create index if not exists idx_turni_data  on public.turni(data_id);
create index if not exists idx_turni_pers  on public.turni(profilo_id);

alter table public.piani_turni enable row level security;
alter table public.turni       enable row level security;

-- ── Permessi: tutti leggono (ognuno deve vedere il proprio turno),
--    scrivono solo i responsabili dei turni e l'amministrazione ──
create policy piani_select on public.piani_turni for select
  using (auth.role() = 'authenticated');
create policy piani_insert on public.piani_turni for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));
create policy piani_update on public.piani_turni for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));
create policy piani_delete on public.piani_turni for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));

create policy turni_select on public.turni for select
  using (auth.role() = 'authenticated');
create policy turni_insert on public.turni for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));
create policy turni_update on public.turni for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));
create policy turni_delete on public.turni for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.gestisce_turni or p.ruolo in ('admin','parroco'))));

-- ── Chi puo' cambiare le due colonne nuove su profili ──────────
-- La tabella profili ha gia' le sue regole di aggiornamento: queste due
-- colonne seguono quelle. Se solo admin/parroco modificano i profili,
-- saranno loro a designare partecipanti e responsabili dei turni.
