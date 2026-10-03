-- ═══════════════════════════════════════════════════
-- CONTROLLO — registro delle modifiche e presenza online
-- Visibile solo all'amministratore.
--
-- 1. registro_modifiche: una riga per ogni aggiunta, modifica o
--    eliminazione, scritta dal database stesso (trigger). Non dipende
--    dalla pagina usata e nessuno puo' cancellarla o falsificarla dall'app.
-- 2. presenza_utenti: ultimo segnale di ogni persona e pagina aperta,
--    per sapere chi e' collegato adesso e quando e' entrato l'ultima volta.
--
-- Solo aggiunte: nessun dato esistente viene toccato.
-- ═══════════════════════════════════════════════════

-- ── 1. Tabella del registro ───────────────────────────────────
create table if not exists public.registro_modifiche (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  utente_id uuid,            -- chi l'ha fatto (vuoto = dal pannello del database)
  tabella text not null,
  operazione text not null,  -- INSERT | UPDATE | DELETE
  record_id text,
  descrizione text,          -- a cosa si riferisce, in chiaro (es. "Rossi Mario")
  modifiche jsonb            -- UPDATE: { campo: [prima, dopo] } · DELETE: la riga eliminata
);

create index if not exists idx_registro_data   on public.registro_modifiche (created_at desc);
create index if not exists idx_registro_utente on public.registro_modifiche (utente_id, created_at desc);

alter table public.registro_modifiche enable row level security;

-- Legge solo l'amministratore. Nessuna regola di scrittura: scrive solo il trigger.
create policy registro_select on public.registro_modifiche for select to authenticated
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo = 'admin'));

-- ── 2. Testi lunghi (canti, lettere) accorciati nel registro ──
create or replace function public.accorcia_json(v jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(v) = 'string' and length(v #>> '{}') > 300
    then to_jsonb(left(v #>> '{}', 300) || '…') else v end;
$$;

-- ── 3. La funzione che scrive nel registro ────────────────────
create or replace function public.registra_modifica() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nuovo jsonb;
  vecchio jsonb;
  riga jsonb;
  diff jsonb;
  descr text;
begin
  begin
    if tg_op <> 'DELETE' then nuovo := to_jsonb(new); end if;
    if tg_op <> 'INSERT' then vecchio := to_jsonb(old); end if;
    riga := coalesce(nuovo, vecchio);

    if tg_op = 'UPDATE' then
      select jsonb_object_agg(n.key, jsonb_build_array(
               public.accorcia_json(vecchio -> n.key), public.accorcia_json(n.value)))
        into diff
      from jsonb_each(nuovo) n
      where n.value is distinct from (vecchio -> n.key) and n.key <> 'updated_at';
      if diff is null then return null; end if;   -- salvataggio senza cambiamenti
    elsif tg_op = 'DELETE' then
      select jsonb_object_agg(v.key, public.accorcia_json(v.value)) into diff
      from jsonb_each(vecchio) v;
    end if;

    descr := case tg_table_name
      when 'presenze' then
        (select b.cognome || ' ' || b.nome from bambini b where b.id = (riga ->> 'bambino_id')::uuid)
        || ': ' || coalesce(riga ->> 'stato', '')
      when 'classi_catechisti' then
        (select c.nome from classi c where c.id = (riga ->> 'classe_id')::uuid) || ' — ' ||
        (select p.nome || ' ' || p.cognome from profili p where p.id = (riga ->> 'catechista_id')::uuid)
      when 'turni' then
        replace(riga ->> 'ruolo', '_', ' ') || ' — ' ||
        coalesce((select p.nome || ' ' || p.cognome from profili p where p.id = (riga ->> 'profilo_id')::uuid), 'nessuno') ||
        coalesce(' (' || (select to_char(d.data, 'DD/MM') from date_catechismo d where d.id = (riga ->> 'data_id')::uuid) || ')', '')
      when 'piani_turni' then
        'mese ' || (riga ->> 'mese') || '/' || (riga ->> 'anno') || ' — ' || (riga ->> 'stato')
      when 'supplenze' then
        coalesce((select c.nome from classi c where c.id = (riga ->> 'classe_id')::uuid), '') || ' — ' ||
        coalesce((select p.nome || ' ' || p.cognome from profili p where p.id = (riga ->> 'catechista_supplente_id')::uuid), '') ||
        ' (' || coalesce(riga ->> 'stato', '') || ')'
      when 'note_giornata' then
        (select c.nome from classi c where c.id = (riga ->> 'classe_id')::uuid)
      when 'date_catechismo' then
        (riga ->> 'data') || coalesce(' — ' || nullif(riga ->> 'descrizione', ''), '')
      when 'scalette_canti' then
        (select s.nome from scalette s where s.id = (riga ->> 'scaletta_id')::uuid) || ' — ' ||
        (select k.titolo from canti k where k.id = (riga ->> 'canto_id')::uuid)
      when 'prenotazioni_stanze' then
        (select s.nome from stanze s where s.id = (riga ->> 'stanza_id')::uuid) || ' — ' || (riga ->> 'data')
      when 'presenze_coro' then
        coalesce((select p.nome || ' ' || p.cognome from profili p where p.id = (riga ->> 'corista_id')::uuid), '') ||
        ' — ' || (riga ->> 'data')
      else null
    end;

    if descr is null then
      descr := coalesce(
        nullif(trim(concat_ws(' ', riga ->> 'cognome', riga ->> 'nome')), ''),
        riga ->> 'nome_ente', riga ->> 'titolo', riga ->> 'descrizione', riga ->> 'data');
    end if;

    insert into public.registro_modifiche (utente_id, tabella, operazione, record_id, descrizione, modifiche)
    values (auth.uid(), tg_table_name, tg_op, riga ->> 'id', left(descr, 200), diff);
  exception when others then
    null;   -- il registro non deve mai impedire un salvataggio
  end;
  return null;
end $$;

-- ── 4. Si aggancia a tutte le tabelle di lavoro ───────────────
-- Fuori: log_attivita (accessi), backup_assegnazioni, canto_attivo
-- (cambia a ogni canto lanciato) e le due tabelle di questo file.
do $$
declare t text;
begin
  foreach t in array array[
    'archivio_file','attivita_classe','avvisi_neo','bacheca','bambini','canti','classi',
    'classi_catechisti','comunita_neo','date_catechismo','eventi_calendario','iscrizioni',
    'lettere','membri_neo','note_giornata','piani_turni','prenotazioni_stanze','presenze',
    'presenze_coro','profili','rubrica','scalette','scalette_canti','stanze','supplenze','turni']
  loop
    if not exists (select 1 from pg_trigger
                   where tgname = 'trg_registro' and tgrelid = ('public.' || t)::regclass) then
      execute format(
        'create trigger trg_registro after insert or update or delete on public.%I
           for each row execute function public.registra_modifica()', t);
    end if;
  end loop;
end $$;

-- ── 5. Presenza online ────────────────────────────────────────
create table if not exists public.presenza_utenti (
  utente_id uuid primary key references public.profili(id) on delete cascade,
  ultimo_segnale timestamptz not null default now(),
  pagina text,       -- pagina aperta, in chiaro (es. "Catechismo › Presenze")
  dispositivo text   -- Telefono | Computer
);

alter table public.presenza_utenti enable row level security;

-- Legge solo l'amministratore. Nessuna regola di scrittura: si scrive solo
-- con la funzione qui sotto, cosi' l'orario lo mette il database e ognuno
-- puo' segnalare soltanto se stesso.
create policy presenza_select on public.presenza_utenti for select to authenticated
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo = 'admin'));

create or replace function public.segnala_presenza(p_pagina text, p_dispositivo text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.presenza_utenti (utente_id, ultimo_segnale, pagina, dispositivo)
  select auth.uid(), now(), left(p_pagina, 120), left(p_dispositivo, 40)
  where exists(select 1 from public.profili where id = auth.uid())
  on conflict (utente_id) do update
    set ultimo_segnale = excluded.ultimo_segnale,
        pagina = excluded.pagina,
        dispositivo = coalesce(excluded.dispositivo, presenza_utenti.dispositivo);
$$;

revoke all on function public.segnala_presenza(text, text) from public, anon;
grant execute on function public.segnala_presenza(text, text) to authenticated;

-- ── 6. Anche il vecchio registro degli accessi: solo amministratore ──
alter policy "Admin legge log_attivita" on public.log_attivita
  using (exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo = 'admin'));
