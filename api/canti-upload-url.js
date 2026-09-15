// Funzione serverless (Vercel) — genera un link di caricamento firmato per Cloudflare R2.
// L'app la chiama PRIMA di caricare un PDF: verifica che l'utente sia autenticato,
// poi restituisce un URL temporaneo con cui il browser carica il file direttamente su R2.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Verifica il token di sessione Supabase dell'utente. Ritorna l'utente o null.
async function verificaUtente(token) {
  if (!token) return null
  try {
    const r = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function r2Client() {
  return new S3Client({
    region: 'auto',
    // .trim() difensivo: un a capo o uno spazio incollato per sbaglio
    // farebbe fallire la firma della richiesta con un errore oscuro.
    endpoint: `https://${(process.env.R2_ACCOUNT_ID || '').trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
    },
  })
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' }); return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const utente = await verificaUtente(token)
  if (!utente || !utente.id) {
    res.status(401).json({ error: 'Non autenticato' }); return
  }

  const cantoId = req.body && req.body.cantoId
  if (!cantoId || !UUID_RE.test(cantoId)) {
    res.status(400).json({ error: 'ID canto non valido' }); return
  }

  const key = `${cantoId}.pdf`
  try {
    const url = await getSignedUrl(
      r2Client(),
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        ContentType: 'application/pdf',
      }),
      { expiresIn: 120 } // il link scade dopo 2 minuti
    )
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
    res.status(200).json({ uploadUrl: url, publicUrl: `${base}/${key}` })
  } catch (e) {
    res.status(500).json({ error: 'Errore generazione link: ' + e.message })
  }
}
