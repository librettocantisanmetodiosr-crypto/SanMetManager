-- ═══════════════════════════════════════════════════
-- BACHECA — modifica, eliminazione e destinatari
--
-- PRIMA: la tabella aveva solo le regole di lettura e inserimento, quindi
-- "Elimina" (che spegne il campo `attivo`) veniva bloccato in silenzio.
-- Inoltre ogni avviso era visibile a tutti, qualunque fosse il destinatario.
--
-- ORA: `destinatari` contiene uno o piu' valori separati da virgola:
--   tutti | catechisti | segreteria | comitato | coro | neocatecumenali
--   u:<id profilo>   per una persona precisa
-- e ognuno legge solo gli avvisi che lo riguardano.
-- ═══════════════════════════════════════════════════

-- ── 1. Modifica ed eliminazione: solo chi gestisce ────────────
create policy bacheca_update on public.bacheca for update to authenticated
  using (exists(select 1 from public.profili p
    where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

create policy bacheca_delete on public.bacheca for delete to authenticated
  using (exists(select 1 from public.profili p
    where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria')));

-- ── 2. I gruppi a cui appartiene chi e' collegato ─────────────
create or replace function public.gruppi_utente() returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.ruolo in ('catechista','responsabile')
           or coalesce(p.ruoli_extra,'{}'::text[]) && array['catechista','responsabile']
         then 'catechisti' end,
    case when p.ruolo in ('comitato','responsabile_comitato')
           or coalesce(p.ruoli_extra,'{}'::text[]) && array['comitato','responsabile_comitato']
         then 'comitato' end,
    case when p.ruolo in ('corista','responsabile_coro')
           or coalesce(p.ruoli_extra,'{}'::text[]) && array['corista','responsabile_coro']
         then 'coro' end,
    case when p.ruolo in ('neocatecumenale','responsabile_neo')
           or coalesce(p.ruoli_extra,'{}'::text[]) && array['neocatecumenale','responsabile_neo']
         then 'neocatecumenali' end,
    case when p.ruolo in ('admin','parroco','segreteria') then 'segreteria' end
  ], null)
  from public.profili p where p.id = auth.uid();
$$;

-- ── 3. Lettura: l'autore, chi gestisce, e i destinatari ───────
alter policy bacheca_select on public.bacheca to authenticated
  using (
    autore_id = auth.uid()
    or exists(select 1 from public.profili p
      where p.id = auth.uid() and p.ruolo in ('admin','parroco','segreteria'))
    or string_to_array(replace(coalesce(destinatari,'tutti'),' ',''), ',')
       && (array['tutti', 'u:' || auth.uid()::text] || coalesce(public.gruppi_utente(), '{}'::text[]))
  );
