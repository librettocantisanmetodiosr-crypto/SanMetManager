// ⚠️ ENDPOINT TEMPORANEO DI MIGRAZIONE — da rimuovere a migrazione conclusa.
// Copia lato server un PDF dal vecchio bucket Supabase a Cloudflare R2.
// Non accetta URL arbitrari: prende solo l'id del canto e ricostruisce
// internamente l'indirizzo di origine, cosi' non puo' essere usato per
// caricare su R2 file che arrivano da altrove.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' }); return
  }

  const cantoId = req.body && req.body.cantoId
  if (!cantoId || !UUID_RE.test(cantoId)) {
    res.status(400).json({ error: 'ID canto non valido' }); return
  }

  const key = `${cantoId}.pdf`
  const origine = `${(process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/canti-pdf/${key}`

  try {
    // 1. Scarica dal vecchio bucket Supabase (pubblico in lettura)
    const r = await fetch(origine)
    if (!r.ok) {
      res.status(404).json({ error: `File non trovato su Supabase (HTTP ${r.status})`, origine }); return
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.slice(0, 4).toString('latin1').startsWith('%PDF')) {
      res.status(422).json({ error: 'Il file scaricato non e\' un PDF valido' }); return
    }

    // 2. Carica su R2 con le credenziali gia' presenti su Vercel
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${(process.env.R2_ACCOUNT_ID || '').trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
        secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
      },
    })
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: 'application/pdf',
    }))

    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
    res.status(200).json({ ok: true, bytes: buf.length, publicUrl: `${base}/${key}` })
  } catch (e) {
    res.status(500).json({ error: (e.name || 'Errore') + ': ' + (e.message || '') })
  }
}
