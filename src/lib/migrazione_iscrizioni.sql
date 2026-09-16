-- ═══════════════════════════════════════════════════
-- ISCRIZIONI — nuova sezione per raccogliere le iscrizioni
-- e smistare i bambini nelle classi.
-- Solo aggiunte: non modifica ne' cancella tabelle esistenti.
-- Eseguire una sola volta nel SQL Editor di Supabase.
-- ═══════════════════════════════════════════════════

create table if not exists public.iscrizioni (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  cognome text not null,
  data_nascita date,
  indirizzo text,
  telefono1 text,
  telefono2 text,
  genitore text,                 -- nome del genitore di riferimento
  preferenza text,               -- "vorrebbe stare con..." (richieste delle famiglie)
  note text,
  anno text,                     -- anno catechistico, es. 2026/27
  classe_id uuid references public.classi(id) on delete set null,   -- classe proposta
  stato text not null default 'da_assegnare',   -- da_assegnare | assegnato | confermato
  bambino_id uuid references public.bambini(id) on delete set null, -- creato alla conferma
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_iscrizioni_stato on public.iscrizioni(stato);
create index if not exists idx_iscrizioni_classe on public.iscrizioni(classe_id);

-- aggiorna updated_at in automatico (riusa la funzione gia' presente)
drop trigger if exists trg_iscrizioni_updated on public.iscrizioni;
create trigger trg_iscrizioni_updated
  before update on public.iscrizioni
  for each row execute function update_updated_at();

-- ── Protezioni: solo admin, parroco e segreteria ──────────────
alter table public.iscrizioni enable row level security;

drop policy if exists "iscrizioni_select" on public.iscrizioni;
create policy "iscrizioni_select" on public.iscrizioni for select
  using (exists(select 1 from public.profili p
                where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

drop policy if exists "iscrizioni_insert" on public.iscrizioni;
create policy "iscrizioni_insert" on public.iscrizioni for insert
  with check (exists(select 1 from public.profili p
                     where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

drop policy if exists "iscrizioni_update" on public.iscrizioni;
create policy "iscrizioni_update" on public.iscrizioni for update
  using (exists(select 1 from public.profili p
                where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

drop policy if exists "iscrizioni_delete" on public.iscrizioni;
create policy "iscrizioni_delete" on public.iscrizioni for delete
  using (exists(select 1 from public.profili p
                where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));
