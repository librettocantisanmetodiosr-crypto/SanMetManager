-- ═══════════════════════════════════════════════════
-- SANMETMANAGER — Schema Database Completo
-- Parrocchia San Metodio, Siracusa
-- ═══════════════════════════════════════════════════

-- ESTENSIONI
create extension if not exists "uuid-ossp";

-- ═══════════════════════════════════════════════════
-- UTENTI E AUTENTICAZIONE
-- ═══════════════════════════════════════════════════

create table public.profili (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  nome text,
  cognome text,
  telefono text,
  ruolo text not null default 'catechista',
  attivo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: aggiorna updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_profili_updated
  before update on public.profili
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════
-- CATECHISMO
-- ═══════════════════════════════════════════════════

create table public.classi (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  anno_cammino text,
  giorno text default 'Sabato',
  note text,
  attiva boolean default true,
  created_at timestamptz default now()
);

-- Tabella ponte: catechisti assegnati a classi
create table public.classi_catechisti (
  id uuid default uuid_generate_v4() primary key,
  classe_id uuid references public.classi(id) on delete cascade,
  catechista_id uuid references public.profili(id) on delete cascade,
  unique(classe_id, catechista_id)
);

create table public.bambini (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  cognome text not null,
  data_nascita date,
  indirizzo text,
  telefono1 text,
  telefono2 text,
  note text,
  classe_id uuid references public.classi(id) on delete set null,
  attivo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_bambini_updated
  before update on public.bambini
  for each row execute function update_updated_at();

-- Date del catechismo (generate auto o manuali)
create table public.date_catechismo (
  id uuid default uuid_generate_v4() primary key,
  data date not null unique,
  tipo text default 'ordinario', -- ordinario | extra | sospeso
  descrizione text,
  anno_inizio int,
  anno_fine int,
  created_at timestamptz default now()
);

-- Registro presenze
create table public.presenze (
  id uuid default uuid_generate_v4() primary key,
  bambino_id uuid references public.bambini(id) on delete cascade,
  data_id uuid references public.date_catechismo(id) on delete cascade,
  stato text not null default 'A', -- P | A
  note_bambino text,
  unique(bambino_id, data_id)
);

-- Note attività per classe e data
create table public.note_giornata (
  id uuid default uuid_generate_v4() primary key,
  classe_id uuid references public.classi(id) on delete cascade,
  data_id uuid references public.date_catechismo(id) on delete cascade,
  catechista_id uuid references public.profili(id) on delete set null,
  testo text,
  created_at timestamptz default now(),
  unique(classe_id, data_id)
);

-- Supplenze temporanee
create table public.supplenze (
  id uuid default uuid_generate_v4() primary key,
  classe_id uuid references public.classi(id) on delete cascade,
  catechista_supplente_id uuid references public.profili(id) on delete cascade,
  data_id uuid references public.date_catechismo(id) on delete cascade,
  autorizzato_da uuid references public.profili(id),
  created_at timestamptz default now(),
  unique(classe_id, catechista_supplente_id, data_id)
);

-- ═══════════════════════════════════════════════════
-- BACHECA
-- ═══════════════════════════════════════════════════

create table public.bacheca (
  id uuid default uuid_generate_v4() primary key,
  titolo text not null,
  testo text not null,
  destinatari text default 'tutti', -- tutti | catechisti | segreteria | comitato | neo | coro
  autore_id uuid references public.profili(id) on delete set null,
  attivo boolean default true,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════
-- COMITATO
-- ═══════════════════════════════════════════════════

create table public.eventi_calendario (
  id uuid default uuid_generate_v4() primary key,
  titolo text not null,
  data date not null,
  ora_inizio time,
  ora_fine time,
  luogo text,
  note text,
  colore text default '#2980b9',
  autore_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now()
);

create table public.rubrica (
  id uuid default uuid_generate_v4() primary key,
  nome_ente text not null,
  referente text,
  email text,
  telefono text,
  note text,
  created_at timestamptz default now()
);

create table public.lettere (
  id uuid default uuid_generate_v4() primary key,
  titolo text not null,
  destinatario_libero text,
  rubrica_id uuid references public.rubrica(id) on delete set null,
  contenuto jsonb not null default '{}', -- struttura campi lettera
  stato text default 'bozza', -- bozza | inviata
  autore_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_lettere_updated
  before update on public.lettere
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════
-- CORO
-- ═══════════════════════════════════════════════════

create table public.canti (
  id uuid default uuid_generate_v4() primary key,
  titolo text not null,
  categoria text, -- es: offertorio, kyrie, alleluia, comunione, mariano...
  tonalita text,
  testo text, -- testo del canto
  accordi text, -- accordi (testo con marcatori es. [Sol] [Re])
  pdf_url text, -- link a PDF se caricato
  autore_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_canti_updated
  before update on public.canti
  for each row execute function update_updated_at();

-- Canto attivo in realtime (uno solo alla volta)
create table public.canto_attivo (
  id int primary key default 1, -- sempre riga singola
  canto_id uuid references public.canti(id) on delete set null,
  lanciato_da uuid references public.profili(id) on delete set null,
  lanciato_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into public.canto_attivo (id) values (1) on conflict do nothing;

-- Presenze prove coro
create table public.presenze_coro (
  id uuid default uuid_generate_v4() primary key,
  corista_id uuid references public.profili(id) on delete cascade,
  data date not null,
  presente boolean default true,
  unique(corista_id, data)
);

-- ═══════════════════════════════════════════════════
-- NEOCATECUMENALI
-- ═══════════════════════════════════════════════════

create table public.comunita_neo (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  anno_cammino int,
  responsabile1 text,
  responsabile2 text,
  note text,
  created_at timestamptz default now()
);

create table public.membri_neo (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  cognome text not null,
  telefono text,
  comunita_id uuid references public.comunita_neo(id) on delete cascade,
  anno_cammino int,
  note text,
  created_at timestamptz default now()
);

create table public.stanze (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  capienza int,
  note text
);

-- Inserimento stanze default
insert into public.stanze (nome, capienza) values
  ('Chiesa', 300),
  ('Salone', 80),
  ('Stanza 1', 20),
  ('Stanza 2', 20),
  ('Stanza 3', 20);

create table public.prenotazioni_stanze (
  id uuid default uuid_generate_v4() primary key,
  stanza_id uuid references public.stanze(id) on delete cascade,
  comunita_id uuid references public.comunita_neo(id) on delete cascade,
  data date not null,
  ora_inizio time,
  ora_fine time,
  note text,
  autore_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now()
);

create table public.avvisi_neo (
  id uuid default uuid_generate_v4() primary key,
  titolo text not null,
  testo text not null,
  comunita_id uuid references public.comunita_neo(id) on delete cascade,
  autore_id uuid references public.profili(id) on delete set null,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════

alter table public.profili enable row level security;
alter table public.classi enable row level security;
alter table public.bambini enable row level security;
alter table public.presenze enable row level security;
alter table public.bacheca enable row level security;
alter table public.lettere enable row level security;
alter table public.canti enable row level security;
alter table public.canto_attivo enable row level security;

-- Profili: ogni utente vede il proprio, admin/segreteria vedono tutti
create policy "profili_select" on public.profili for select
  using (auth.uid() = id or exists(
    select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')
  ));

-- Inserimento profili: auto-registrazione al primo login OPPURE admin/segreteria creano profili per altri
create policy "profili_insert" on public.profili for insert
  with check (
    auth.uid() = id
    or exists(
      select 1 from public.profili p
      where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')
    )
  );

-- Aggiornamento profili: ognuno aggiorna il proprio, admin/segreteria aggiornano tutti
drop policy if exists "profili_update_self" on public.profili;
create policy "profili_update" on public.profili for update
  using (
    auth.uid() = id
    or exists(
      select 1 from public.profili p
      where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')
    )
  );

-- Classi: tutti gli autenticati leggono, solo admin/segreteria modificano
create policy "classi_select" on public.classi for select using (auth.role() = 'authenticated');
create policy "classi_insert" on public.classi for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));
create policy "classi_update" on public.classi for update
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));
create policy "classi_delete" on public.classi for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco')));

-- Bambini: catechista vede solo la sua classe
create policy "bambini_select" on public.bambini for select
  using (
    exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
    or exists(
      select 1 from public.classi_catechisti cc
      where cc.catechista_id = auth.uid() and cc.classe_id = bambini.classe_id
    )
    or exists(
      select 1 from public.supplenze s
      where s.catechista_supplente_id = auth.uid() and s.classe_id = bambini.classe_id
        and s.data_id in (select id from public.date_catechismo where data = current_date)
    )
  );

-- Presenze: stessa logica bambini
create policy "presenze_select" on public.presenze for select using (auth.role() = 'authenticated');
create policy "presenze_insert" on public.presenze for insert with check (auth.role() = 'authenticated');
create policy "presenze_update" on public.presenze for update using (auth.role() = 'authenticated');

-- Canti: tutti leggono (anche senza login per il coro)
create policy "canti_select" on public.canti for select using (true);
create policy "canti_insert" on public.canti for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro')));
create policy "canti_update" on public.canti for update
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro')));
create policy "canti_delete" on public.canti for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro')));

-- Canto attivo: tutti leggono, solo responsabile_coro aggiorna
create policy "canto_attivo_select" on public.canto_attivo for select using (true);
create policy "canto_attivo_update" on public.canto_attivo for update
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro')));

-- Lettere: solo comitato e admin
create policy "lettere_select" on public.lettere for select
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','comitato')));
create policy "lettere_insert" on public.lettere for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','comitato')));

-- Bacheca: tutti leggono
create policy "bacheca_select" on public.bacheca for select using (auth.role() = 'authenticated');
create policy "bacheca_insert" on public.bacheca for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

-- ═══════════════════════════════════════════════════
-- FUNZIONI UTILI
-- ═══════════════════════════════════════════════════

-- Genera date sabati da ottobre a maggio
create or replace function genera_date_catechismo(anno_inizio int, anno_fine int)
returns void as $$
declare
  d date;
  mese_inizio date := make_date(anno_inizio, 10, 1);
  mese_fine date := make_date(anno_fine, 5, 31);
begin
  d := mese_inizio;
  while d <= mese_fine loop
    if extract(dow from d) = 6 then -- 6 = sabato
      insert into public.date_catechismo (data, tipo, anno_inizio, anno_fine)
      values (d, 'ordinario', anno_inizio, anno_fine)
      on conflict (data) do nothing;
    end if;
    d := d + 1;
  end loop;
end;
$$ language plpgsql;

-- Statistiche presenze per classe
create or replace function stats_presenze_classe(p_classe_id uuid)
returns table(bambino_id uuid, nome text, cognome text, tot_presenti bigint, tot_assenti bigint, tot_incontri bigint) as $$
begin
  return query
  select b.id, b.nome, b.cognome,
    count(case when p.stato = 'P' then 1 end) as tot_presenti,
    count(case when p.stato = 'A' then 1 end) as tot_assenti,
    count(p.id) as tot_incontri
  from public.bambini b
  left join public.presenze p on p.bambino_id = b.id
  where b.classe_id = p_classe_id and b.attivo = true
  group by b.id, b.nome, b.cognome
  order by b.cognome, b.nome;
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════
-- STORAGE: bucket PDF canti
-- ═══════════════════════════════════════════════════

-- Crea il bucket (eseguire in Supabase → Storage → New bucket oppure via SQL):
insert into storage.buckets (id, name, public)
  values ('canti-pdf', 'canti-pdf', true)
  on conflict (id) do nothing;

-- Policy Storage: chiunque può leggere (PDF pubblici)
create policy "canti_pdf_read" on storage.objects for select
  using (bucket_id = 'canti-pdf');

-- Policy Storage: solo responsabile_coro/admin può caricare
create policy "canti_pdf_upload" on storage.objects for insert
  with check (
    bucket_id = 'canti-pdf'
    and exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro'))
  );

create policy "canti_pdf_delete" on storage.objects for delete
  using (
    bucket_id = 'canti-pdf'
    and exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','responsabile_coro'))
  );

-- ═══════════════════════════════════════════════════
-- PERMESSI FUNZIONI
-- ═══════════════════════════════════════════════════

-- Permette agli utenti autenticati di chiamare genera_date_catechismo via RPC
grant execute on function genera_date_catechismo(int, int) to authenticated;
grant execute on function stats_presenze_classe(uuid) to authenticated;

-- ═══════════════════════════════════════════════════
-- DATI INIZIALI
-- ═══════════════════════════════════════════════════

-- Nota: l'utente admin viene creato tramite Supabase Auth
-- poi il profilo viene creato via trigger o manualmente:

-- Esempio inserimento profilo admin dopo registrazione:
-- insert into public.profili (id, username, nome, cognome, ruolo)
-- values ('<uuid-from-auth>', 'marco.tarascio', 'Marco', 'Tarascio', 'admin');
