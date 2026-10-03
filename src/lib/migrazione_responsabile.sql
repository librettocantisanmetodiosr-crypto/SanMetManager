-- ═══════════════════════════════════════════════════
-- RUOLO "RESPONSABILE" — vede e gestisce tutto come la segreteria
--
-- PROBLEMA: quando le regole di accesso sono state ristrette ad
-- admin / parroco / segreteria, il ruolo `responsabile` e' rimasto fuori.
-- L'app le mostrava tutte le pagine, ma il database non le restituiva
-- nessun bambino (ne' iscrizioni, supplenze, ecc.).
--
-- SOLUZIONE: in ogni regola che gia' ammette la segreteria si aggiunge
-- anche `responsabile`. Fa eccezione la scrittura sui profili (creare,
-- modificare, disattivare utenti): quella resta com'e', perche' la
-- gestione degli utenti spetta solo all'amministratore.
--
-- APPLICATO il 3 ottobre 2026 (bacheca, bambini, classi, eventi_calendario,
-- iscrizioni, note_giornata, rubrica, stanze, supplenze).
-- Solo aggiunte: nessun dato viene toccato. Se qualcosa non torna il
-- blocco si annulla da solo per intero, senza lasciare regole a meta'.
-- ═══════════════════════════════════════════════════

do $$
declare
  r record;
  q text;
  w text;
  n int := 0;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') || coalesce(with_check,'')) like '%''segreteria''%'
      and (coalesce(qual,'') || coalesce(with_check,'')) not like '%''responsabile''%'
      and tablename <> 'profili'
  loop
    q := replace(r.qual,       '''segreteria''::text', '''segreteria''::text, ''responsabile''::text');
    w := replace(r.with_check, '''segreteria''::text', '''segreteria''::text, ''responsabile''::text');
    execute format('alter policy %I on public.%I %s %s',
      r.policyname, r.tablename,
      case when q is not null then 'using (' || q || ')' else '' end,
      case when w is not null then 'with check (' || w || ')' else '' end);
    n := n + 1;
  end loop;
  raise notice 'Regole aggiornate: %', n;
end $$;

-- Controllo: non deve restituire righe (a parte la scrittura sui profili)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (coalesce(qual,'') || coalesce(with_check,'')) like '%''segreteria''%'
  and (coalesce(qual,'') || coalesce(with_check,'')) not like '%''responsabile''%'
order by 1, 2;
