-- ═══════════════════════════════════════════════════
-- SBLOCCO TABELLE + RICHIESTE DI SUPPLENZA
--
-- Sei tabelle avevano RLS attivo ma ZERO regole: in Postgres questo
-- significa "nega tutto", quindi l'app non poteva ne' leggerle ne'
-- scriverle (calendario, rubrica, supplenze, avvisi neo, note giornata,
-- presenze coro erano di fatto inutilizzabili).
--
-- Solo aggiunte e una modifica in-place di una regola esistente:
-- nessun comando di rimozione, nessun dato toccato.
-- ═══════════════════════════════════════════════════

-- ── 1. Supplenze: nuove colonne per le richieste ──────────────
alter table public.supplenze add column if not exists richiesto_da uuid references public.profili(id) on delete set null;
alter table public.supplenze add column if not exists stato text not null default 'attiva';  -- attiva | in_attesa | accettata | rifiutata
alter table public.supplenze add column if not exists messaggio text;
alter table public.supplenze add column if not exists risposto_at timestamptz;

-- ── 2. IMPORTANTE: una supplenza da' accesso ai bambini di quella
--       classe. Ora che esistono richieste ancora da accettare, la
--       regola deve valere SOLO per quelle attive o accettate,
--       altrimenti basterebbe chiedere per vedere i dati.
alter policy "bambini_select" on public.bambini
  using (
    exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
    or exists(
      select 1 from public.classi_catechisti cc
      where cc.catechista_id = auth.uid() and cc.classe_id = bambini.classe_id
    )
    or exists(
      select 1 from public.supplenze s
      where s.catechista_supplente_id = auth.uid() and s.classe_id = bambini.classe_id
        and s.stato in ('attiva','accettata')
        and s.data_id in (select id from public.date_catechismo where data = current_date)
    )
  );

-- ── 3. Supplenze: chi puo' fare cosa ──────────────────────────
-- Tutti gli utenti autenticati vedono le supplenze (serve per sapere
-- chi copre cosa). Un catechista puo' creare una richiesta a suo nome.
create policy supplenze_select on public.supplenze for select
  using (auth.role() = 'authenticated');

create policy supplenze_insert on public.supplenze for insert
  with check (
    auth.role() = 'authenticated'
    and (
      richiesto_da = auth.uid()   -- richiesta fatta da me
      or exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
    )
  );

-- Puo' aggiornare: chi ha fatto la richiesta, chi la riceve (per accettare
-- o rifiutare) e l'amministrazione.
create policy supplenze_update on public.supplenze for update
  using (
    richiesto_da = auth.uid()
    or catechista_supplente_id = auth.uid()
    or exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
  );

create policy supplenze_delete on public.supplenze for delete
  using (
    richiesto_da = auth.uid()
    or exists(select 1 from public.profili p where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
  );

-- ── 4. Calendario eventi: lo leggono tutti, lo scrive il comitato ──
create policy eventi_select on public.eventi_calendario for select
  using (auth.role() = 'authenticated');
create policy eventi_insert on public.eventi_calendario for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','comitato','responsabile_comitato','segreteria')
         or p.ruoli_extra && array['comitato','responsabile_comitato']::text[])));
create policy eventi_update on public.eventi_calendario for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','comitato','responsabile_comitato','segreteria')
         or p.ruoli_extra && array['comitato','responsabile_comitato']::text[])));
create policy eventi_delete on public.eventi_calendario for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_comitato')
         or p.ruoli_extra && array['responsabile_comitato']::text[])));

-- ── 5. Rubrica del COMITATO: contatti di collaboratori.
--       Non e' la rubrica delle famiglie del catechismo (quella sta
--       dentro i bambini). Quindi la vede solo il comitato + amministrazione.
create policy rubrica_select on public.rubrica for select
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','segreteria','comitato','responsabile_comitato')
         or p.ruoli_extra && array['comitato','responsabile_comitato']::text[])));
create policy rubrica_write on public.rubrica for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','segreteria','responsabile_comitato')
         or p.ruoli_extra && array['responsabile_comitato']::text[])));
create policy rubrica_update on public.rubrica for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','segreteria','responsabile_comitato')
         or p.ruoli_extra && array['responsabile_comitato']::text[])));
create policy rubrica_delete on public.rubrica for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_comitato')
         or p.ruoli_extra && array['responsabile_comitato']::text[])));

-- ── 6. Avvisi neocatecumenali ─────────────────────────────────
create policy avvisi_neo_select on public.avvisi_neo for select
  using (auth.role() = 'authenticated');
create policy avvisi_neo_insert on public.avvisi_neo for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_neo')
         or p.ruoli_extra && array['responsabile_neo']::text[])));
create policy avvisi_neo_update on public.avvisi_neo for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_neo')
         or p.ruoli_extra && array['responsabile_neo']::text[])));
create policy avvisi_neo_delete on public.avvisi_neo for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_neo')
         or p.ruoli_extra && array['responsabile_neo']::text[])));

-- ── 7. Note di giornata: le scrivono i catechisti ─────────────
create policy note_select on public.note_giornata for select
  using (auth.role() = 'authenticated');
create policy note_insert on public.note_giornata for insert
  with check (auth.role() = 'authenticated');
create policy note_update on public.note_giornata for update
  using (auth.role() = 'authenticated');
create policy note_delete on public.note_giornata for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and p.ruolo in ('admin','parroco','segreteria')));

-- ── 8. Presenze del coro ──────────────────────────────────────
create policy presenze_coro_select on public.presenze_coro for select
  using (auth.role() = 'authenticated');
create policy presenze_coro_insert on public.presenze_coro for insert
  with check (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_coro')
         or p.ruoli_extra && array['responsabile_coro']::text[])));
create policy presenze_coro_update on public.presenze_coro for update
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_coro')
         or p.ruoli_extra && array['responsabile_coro']::text[])));
create policy presenze_coro_delete on public.presenze_coro for delete
  using (exists(select 1 from public.profili p where p.id = auth.uid()
    and (p.ruolo in ('admin','parroco','responsabile_coro')
         or p.ruoli_extra && array['responsabile_coro']::text[])));
