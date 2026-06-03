# 🚀 Guida installazione SanMetManager v3
## Parrocchia San Metodio — Siracusa

---

## PASSO 1 — Crea il database su Supabase (gratis, 5 minuti)

1. Vai su **https://supabase.com** e clicca **Start your project**
2. Registrati con: `librettocantisanmetodiosr@gmail.com`
3. Crea un nuovo progetto:
   - Nome: `sanmetmanager`
   - Regione: **West EU (Ireland)**
4. Aspetta ~2 minuti
5. Vai su **SQL Editor** → incolla tutto il file `src/lib/schema.sql` → clicca **Run**
6. Vai su **Settings → API** e copia:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon/public key** → stringa che inizia con `eyJ...`

---

## PASSO 2 — Crea il tuo account admin

1. In Supabase → **Authentication → Users** → **Invite user**
2. Email: `librettocantisanmetodiosr@gmail.com`
3. Riceverai email con link per impostare password
4. Dopo aver impostato la password, in **SQL Editor** esegui:

```sql
INSERT INTO public.profili (id, username, nome, cognome, ruolo)
SELECT id, 'marco.tarascio', 'Marco', 'Tarascio', 'admin'
FROM auth.users
WHERE email = 'librettocantisanmetodiosr@gmail.com';
```

---

## PASSO 3 — Carica su Vercel (gratis, 3 minuti)

1. Vai su **https://github.com** → crea account gratuito
2. Crea repository: **New repository** → nome `sanmetmanager`
3. Carica tutti i file del progetto (trascina la cartella)
4. Vai su **https://vercel.com** → registrati con GitHub
5. **New Project** → seleziona `sanmetmanager`
6. In **Environment Variables** aggiungi:
   - `REACT_APP_SUPABASE_URL` = URL da passo 1
   - `REACT_APP_SUPABASE_ANON_KEY` = chiave da passo 1
7. Clicca **Deploy** → pronto in ~2 minuti!

Indirizzo: **`sanmetmanager.vercel.app`**

---

## PASSO 4 — Aggiungi utenti

Per ogni utente (catechista, corista, ecc.):

1. Supabase → **Authentication → Users → Invite user**
2. Inserisci email dell'utente
3. Dopo che accetta l'invito, esegui in SQL Editor:

```sql
INSERT INTO public.profili (id, username, nome, cognome, ruolo, telefono)
SELECT id, 'nome.cognome', 'Nome', 'Cognome', 'catechista', '333 0000000'
FROM auth.users WHERE email = 'email@esempio.it';
```

### Ruoli disponibili:
| Ruolo | Accesso |
|---|---|
| `admin` | Tutto |
| `parroco` | Tutto |
| `segreteria` | Catechismo completo + tutte le viste |
| `catechista` | Solo sua classe (presenze, bambini, report) |
| `comitato` | Lettere, calendario, rubrica |
| `responsabile_coro` | Coro + lancia canti realtime |
| `corista` | Visualizza canti, si aggiorna in realtime |
| `responsabile_neo` | Neocatecumenali completo |
| `neocatecumenale` | Sua comunità, stanze, avvisi |

---

## Struttura completa (v3)

```
sanmetmanager/
├── src/
│   ├── lib/
│   │   ├── supabase.js       ← configurazione + permessi
│   │   ├── auth.jsx          ← login con crittografia
│   │   └── schema.sql        ← database completo (eseguire su Supabase)
│   ├── hooks/useToast.js
│   ├── components/layout/Layout.jsx   ← navigazione mobile
│   └── pages/
│       ├── Login.jsx          ✅ completo
│       ├── Dashboard.jsx      ✅ grafici + accesso rapido
│       ├── catechismo/
│       │   ├── Classi.jsx     ✅ CRUD completo
│       │   ├── Bambini.jsx    ✅ CRUD + storico presenze per bambino + export CSV
│       │   ├── Presenze.jsx   ✅ P/A + note giornata + salvataggio
│       │   ├── ReportPresenze.jsx ✅ grafici + export CSV + stampa PDF
│       │   ├── Date.jsx       ✅ genera sabati auto + manuali
│       │   ├── Supplenze.jsx  ✅ accesso temporaneo catechista
│       │   ├── Utenti.jsx     ✅ gestione ruoli
│       │   └── Bacheca.jsx    ✅ avvisi con destinatari
│       ├── comitato/
│       │   ├── Calendario.jsx ✅ griglia mensile + CRUD eventi
│       │   ├── Lettere.jsx    ✅ editor + anteprima + stampa PDF
│       │   └── Rubrica.jsx    ✅ CRUD contatti
│       ├── coro/
│       │   ├── Canti.jsx      ✅ libreria + lancia canto REALTIME
│       │   └── Coristi.jsx    ✅ elenco
│       └── neocatecumenali/
│           ├── Comunita.jsx   ✅ comunità + membri
│           ├── Stanze.jsx     ✅ prenotazione 5 spazi
│           └── Avvisi.jsx     ✅ avvisi per comunità
```

---

## Funzionalità complete ✅

### Catechismo
- Login sicuro con crittografia (Supabase Auth)
- Gestione 8 classi con assegnazione catechisti
- Anagrafica 120+ bambini con storico presenze
- Registro presenze P/A per data e classe
- Note attività giornata
- Supplenze temporanee
- Generazione automatica sabati ott→mag
- Report con grafici, export CSV, stampa PDF
- Dashboard admin con grafici mensili e per classe
- Bacheca comunicazioni con destinatari

### Comitato
- Calendario mensile con eventi
- Editor lettere con anteprima e stampa PDF
- Rubrica contatti/destinatari

### Coro
- Libreria canti con testo e accordi colorati
- **Lancia canto realtime** — il pianista preme un tasto, tutti i coristi vedono il canto sul telefono
- Elenco coristi

### Neocatecumenali
- Gestione comunità e membri
- Prenotazione 5 spazi (chiesa, salone, 3 stanze)
- Avvisi interni per comunità

---

## Link utili
- Supabase: https://supabase.com
- Vercel: https://vercel.com
- GitHub: https://github.com

Per continuare lo sviluppo, condividi questa conversazione con Claude.
