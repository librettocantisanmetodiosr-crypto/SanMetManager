-- ═══════════════════════════════════════════════════
-- CHIUSURA ESPOSIZIONE PUBBLICA (applicata il 2026-09-16)
--
-- Alcune tabelle avevano una regola di lettura aperta al ruolo "public",
-- cioe' leggibile da chiunque conoscesse la chiave anonima dell'app
-- (che e' dentro il codice della pagina, quindi pubblica di fatto).
-- In particolare `profili` esponeva nome, cognome, ruolo e telefono
-- di tutte le persone registrate, senza bisogno di alcun login.
--
-- ALTER POLICY ... TO authenticated restringe il destinatario della
-- regola senza rimuoverla: nessun comando distruttivo.
-- ═══════════════════════════════════════════════════

alter policy "profili_select"            on public.profili             to authenticated;
alter policy "comunita_neo_select"       on public.comunita_neo        to authenticated;
alter policy "membri_neo_select"         on public.membri_neo          to authenticated;
alter policy "stanze_select"             on public.stanze              to authenticated;
alter policy "pren_stanze_select"        on public.prenotazioni_stanze to authenticated;
alter policy "Lettura date catechismo"   on public.date_catechismo     to authenticated;

-- NOTA: `canti` e `canto_attivo` restano leggibili senza login: e' una
-- scelta voluta del progetto (i coristi vedono il canto lanciato senza
-- dover accedere) e non sono dati personali.

-- ANCORA DA SISTEMARE: la tabella `bambini` ha due regole aperte
-- ("Lettura bambini" e "Gestione bambini", entrambe con condizione `true`
-- per gli utenti autenticati). Significa che QUALSIASI utente collegato
-- puo' leggere, modificare ed eliminare tutti i bambini.
-- Per toglierle servono prima regole di scrittura adeguate, altrimenti
-- l'app non puo' piu' inserire o modificare nulla.
