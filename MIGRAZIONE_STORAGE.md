# 📦 Spostare i PDF dei canti su Cloudflare R2 (10 GB gratis)

Questa guida serve a collegare l'app a **Cloudflare R2**, dove d'ora in poi
verranno salvati i PDF dei canti (invece che su Supabase, che aveva solo 1 GB).
Il codice è già pronto: qui ci sono solo i passi da fare sul sito di Cloudflare
e su Vercel. Segui l'ordine.

---

## PASSO 1 — Crea l'account Cloudflare e attiva R2

1. Vai su **https://dash.cloudflare.com/sign-up** e registrati (gratis).
2. Nel menu a sinistra clicca **R2**.
3. Ti chiederà di **aggiungere una carta** per attivare R2: è normale, sotto i
   10 GB **non paghi nulla**. Aggiungila per procedere.

## PASSO 2 — Crea il "contenitore" (bucket)

1. In R2 clicca **Create bucket**.
2. Nome del bucket: **`canti-pdf`** (esattamente così).
3. Regione: lascia **Automatic**. Clicca **Create bucket**.

## PASSO 3 — Rendi pubblici i file (così l'app può mostrarli)

1. Apri il bucket `canti-pdf` → scheda **Settings**.
2. Alla voce **Public access → R2.dev subdomain**, clicca **Allow Access**
   (conferma).
3. Copia l'indirizzo pubblico che compare, tipo:
   `https://pub-xxxxxxxxxxxx.r2.dev`
   👉 Questo servirà dopo come **R2_PUBLIC_URL**.

## PASSO 4 — Configura il CORS (permesso al browser di caricare)

1. Sempre in **Settings** del bucket, cerca **CORS Policy** → **Edit / Add**.
2. Incolla questo (sostituisci l'indirizzo Vercel con quello vero della tua app
   se è diverso):

```json
[
  {
    "AllowedOrigins": [
      "https://san-met-manager-dda9.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Salva.

## PASSO 5 — Crea le chiavi di accesso (API token)

1. Nella pagina R2, in alto a destra, apri **Manage R2 API Tokens**
   (o **API → Create API Token**).
2. Clicca **Create API Token**.
3. Permessi: **Object Read & Write**. Bucket: puoi limitarlo a `canti-pdf`.
4. Clicca **Create**. Ti mostrerà UNA VOLTA SOLA:
   - **Access Key ID** → servirà come **R2_ACCESS_KEY_ID**
   - **Secret Access Key** → servirà come **R2_SECRET_ACCESS_KEY**
   👉 Copiali subito in un posto sicuro.
5. Ti serve anche l'**Account ID**: lo trovi nella pagina principale di R2,
   in alto a destra (una stringa di lettere/numeri) → **R2_ACCOUNT_ID**.

## PASSO 6 — Aggiungi le variabili su Vercel

1. Vai su **https://vercel.com** → apri il progetto → **Settings →
   Environment Variables**.
2. Aggiungi queste 5 variabili (Environment: **Production** e **Preview**):

| Nome | Valore |
|---|---|
| `R2_ACCOUNT_ID` | l'Account ID del passo 5 |
| `R2_ACCESS_KEY_ID` | l'Access Key ID del passo 5 |
| `R2_SECRET_ACCESS_KEY` | il Secret Access Key del passo 5 |
| `R2_BUCKET` | `canti-pdf` |
| `R2_PUBLIC_URL` | l'indirizzo pubblico del passo 3 (es. `https://pub-xxxx.r2.dev`) |

3. **Importante:** verifica che ci siano ancora anche
   `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY` (già presenti).

## PASSO 7 — Rilancia il deploy

1. Su Vercel, scheda **Deployments** → sul più recente, menu **···** →
   **Redeploy**.
2. Aspetta ~2 minuti. Fatto: i nuovi PDF andranno su R2.

---

## Note

- **I PDF già caricati prima** restano su Supabase e continuano a funzionare.
  Solo i **nuovi** caricamenti vanno su R2. Se vuoi, in un secondo momento
  possiamo spostare anche i vecchi su R2 e liberare del tutto Supabase.
- Se un caricamento dà errore, controlla che il nome del bucket sia
  esattamente `canti-pdf` e che il CORS (passo 4) contenga l'indirizzo giusto
  della tua app.
