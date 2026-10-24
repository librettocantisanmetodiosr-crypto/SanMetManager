-- ═══════════════════════════════════════════════════
-- TURNI — CLASSE DEL SABATO
--
-- Ogni sabato una classe di catechismo, a rotazione, porta i doni
-- all'altare (offertorio) e legge le preghiere dei fedeli.
--
-- La classe di turno e' una riga in piu' nella tabella `turni`, con
-- ruolo = 'classe' e la nuova colonna `classe_id` (profilo_id vuoto).
-- Cosi' valgono le regole gia' esistenti sui turni: la leggono tutti
-- gli utenti collegati, la scrivono solo chi gestisce i turni,
-- admin, parroco e responsabile.
--
-- Solo aggiunte: nessuna regola cambiata, nessun dato toccato.
-- ═══════════════════════════════════════════════════

alter table public.turni
  add column if not exists classe_id uuid references public.classi(id) on delete set null;

create index if not exists idx_turni_classe on public.turni(classe_id);

-- Controllo: deve restituire una riga
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'turni' and column_name = 'classe_id';
