// ⚠️ ENDPOINT TEMPORANEO DI DIAGNOSI — da rimuovere una volta risolto.
// Non espone MAI il valore delle chiavi: dice solo se sono presenti,
// e prova a contattare il bucket R2 per verificare che le credenziali funzionino.

const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3')

module.exports = async (req, res) => {
  const presenti = {
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: !!process.env.R2_BUCKET,
    R2_PUBLIC_URL: !!process.env.R2_PUBLIC_URL,
    REACT_APP_SUPABASE_URL: !!process.env.REACT_APP_SUPABASE_URL,
    REACT_APP_SUPABASE_ANON_KEY: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
  }

  // Valori non segreti, utili per scoprire errori di battitura
  const valori = {
    R2_BUCKET: process.env.R2_BUCKET || null,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || null,
    R2_ACCOUNT_ID_lunghezza: (process.env.R2_ACCOUNT_ID || '').length,
    R2_ACCESS_KEY_ID_lunghezza: (process.env.R2_ACCESS_KEY_ID || '').length,
    R2_SECRET_ACCESS_KEY_lunghezza: (process.env.R2_SECRET_ACCESS_KEY || '').length,
  }

  let connessioneR2 = 'non testata'
  if (presenti.R2_ACCOUNT_ID && presenti.R2_ACCESS_KEY_ID && presenti.R2_SECRET_ACCESS_KEY && presenti.R2_BUCKET) {
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
      await s3.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }))
      connessioneR2 = 'OK — bucket raggiungibile'
    } catch (e) {
      connessioneR2 = 'ERRORE — ' + (e.name || '') + ': ' + (e.message || '')
    }
  } else {
    connessioneR2 = 'saltata — mancano una o piu variabili'
  }

  res.status(200).json({ presenti, valori, connessioneR2 })
}
