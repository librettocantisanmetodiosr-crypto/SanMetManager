// Funzione serverless (Vercel) — cancella un PDF da Cloudflare R2.
// L'app la chiama quando si rimuove il PDF di un canto.

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
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

  try {
    await r2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: `${cantoId}.pdf`,
    }))
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Errore cancellazione: ' + e.message })
  }
}
