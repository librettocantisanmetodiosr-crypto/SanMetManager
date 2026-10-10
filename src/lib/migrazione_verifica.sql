-- ═══════════════════════════════════════════════════
-- BAMBINI — dati "da verificare"
--
-- Quando un elenco viene trascritto da un foglio scritto a mano, i dati
-- possono contenere errori di lettura. Queste due colonne tengono il
-- bambino segnato finche' qualcuno non lo confronta con l'originale:
--   da_verificare  true = ancora da controllare
--   nota_verifica  cosa c'e' di dubbio (es. "cognome poco leggibile")
-- Dalla pagina Bambini si conferma o si corregge, e il segno sparisce.
--
-- Solo aggiunte: i bambini esistenti restano con da_verificare = false.
-- APPLICATO il 10 ottobre 2026.
-- ═══════════════════════════════════════════════════

alter table public.bambini add column if not exists da_verificare boolean not null default false;
alter table public.bambini add column if not exists nota_verifica text;
