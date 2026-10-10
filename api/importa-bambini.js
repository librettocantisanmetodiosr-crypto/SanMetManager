// Funzione serverless (Vercel) — legge un elenco di bambini da una foto o da un PDF.
// L'app manda il file, Claude lo trascrive in righe ordinate (cognome, nome, data,
// indirizzo, telefono) e segnala le righe cancellate a penna o poco leggibili.
// Qui non si salva nulla: l'elenco torna all'app, che lo mostra per il controllo.
//
// Serve la variabile ANTHROPIC_API_KEY nelle impostazioni di Vercel. Se manca,
// l'app usa da sola il lettore gratuito che gira nel browser (src/lib/ocrElenco.js).

const Anthropic = require('@anthropic-ai/sdk')

const RUOLI_AMMESSI = ['admin', 'parroco', 'segreteria', 'responsabile']
const IMMAGINI = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BASE64 = 4_200_000   // Vercel accetta richieste fino a circa 4,5 MB

const ISTRUZIONI = `Sei un assistente che trascrive elenchi di bambini del catechismo di una parrocchia italiana.
Ricevi la foto o il PDF di un foglio (stampato, con possibili aggiunte e correzioni a penna) e restituisci una riga per ogni bambino elencato, nell'ordine del foglio.

Regole:
- Il foglio può essere ruotato o fotografato storto: leggilo comunque.
- Trascrivi esattamente quello che c'è scritto. Non inventare dati mancanti: se un campo non c'è, lascia la stringa vuota.
- cognome e nome: con l'iniziale maiuscola (es. "DI BELLA" diventa "Di Bella", "D'AMICO" diventa "D'Amico").
- data_nascita: nel formato AAAA-MM-GG. Sul foglio le date sono giorno/mese/anno. Se non è leggibile, stringa vuota.
- indirizzo e telefono: come sul foglio. Fai attenzione ad abbinare ogni telefono e indirizzo alla riga giusta.
- cancellato: true se la riga è barrata o cancellata con una linea a penna. Includi comunque la riga, con i dati che riesci a leggere.
- incerto: true se la riga è scritta a mano o qualche dato è poco leggibile; spiega in "nota" cosa è dubbio. Altrimenti nota vuota.
- Ignora intestazioni, nomi dei catechisti, numeri progressivi e firme.
- Se il documento non contiene un elenco di persone, restituisci un elenco vuoto.`

const SCHEMA = {
  type: 'object',
  properties: {
    bambini: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cognome: { type: 'string' },
          nome: { type: 'string' },
          data_nascita: { type: 'string' },
          indirizzo: { type: 'string' },
          telefono: { type: 'string' },
          cancellato: { type: 'boolean' },
          incerto: { type: 'boolean' },
          nota: { type: 'string' },
        },
        required: ['cognome', 'nome', 'data_nascita', 'indirizzo', 'telefono', 'cancellato', 'incerto', 'nota'],
        additionalProperties: false,
      },
    },
  },
  required: ['bambini'],
  additionalProperties: false,
}

// Verifica la sessione Supabase e controlla che la persona possa gestire i bambini.
async function utenteAutorizzato(token) {
  if (!token) return false
  const base = process.env.REACT_APP_SUPABASE_URL
  const intestazioni = { apikey: process.env.REACT_APP_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: intestazioni })
    if (!r.ok) return false
    const utente = await r.json()
    if (!utente || !utente.id) return false
    const p = await fetch(`${base}/rest/v1/profili?id=eq.${utente.id}&select=ruolo,attivo`, { headers: intestazioni })
    if (!p.ok) return false
    const [profilo] = await p.json()
    return !!profilo && profilo.attivo !== false && RUOLI_AMMESSI.includes(profilo.ruolo)
  } catch {
    return false
  }
}

module.exports = async (req, res) => {
  // l'app chiede prima se la lettura con Claude e' attiva, per non spedire il file a vuoto
  if (req.method === 'GET') {
    res.status(200).json({ claude: !!(process.env.ANTHROPIC_API_KEY || '').trim() }); return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' }); return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!(await utenteAutorizzato(token))) {
    res.status(403).json({ error: 'Non hai i permessi per importare i bambini' }); return
  }

  if (!(process.env.ANTHROPIC_API_KEY || '').trim()) {
    res.status(503).json({
      codice: 'CHIAVE_MANCANTE',
      error: 'La lettura di foto e PDF non è ancora attiva: manca la chiave ANTHROPIC_API_KEY su Vercel',
    }); return
  }

  const { mediaType, dati } = req.body || {}
  const pdf = mediaType === 'application/pdf'
  if (!pdf && !IMMAGINI.includes(mediaType)) {
    res.status(400).json({ error: 'Formato non supportato: usa una foto (JPG, PNG) o un PDF' }); return
  }
  if (typeof dati !== 'string' || dati.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(dati)) {
    res.status(400).json({ error: 'File non valido' }); return
  }
  if (dati.length > MAX_BASE64) {
    res.status(413).json({ error: 'File troppo grande: massimo circa 3 MB' }); return
  }

  const documento = pdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: dati } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: dati } }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim(), timeout: 55_000, maxRetries: 1 })

  try {
    const risposta = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // se il modello rifiuta la richiesta, l'API la ripete da sola su quello di riserva
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: ISTRUZIONI,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [documento, { type: 'text', text: 'Trascrivi l\'elenco dei bambini di questo foglio.' }],
      }],
    })

    if (risposta.stop_reason === 'refusal') {
      res.status(422).json({ error: 'Il documento non è stato letto: prova con una foto più nitida' }); return
    }
    if (risposta.stop_reason === 'max_tokens') {
      res.status(422).json({ error: 'Elenco troppo lungo: importa una pagina alla volta' }); return
    }

    const testo = risposta.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const { bambini } = JSON.parse(testo)
    res.status(200).json({ bambini })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      res.status(503).json({ codice: 'CHIAVE_NON_VALIDA', error: 'La chiave ANTHROPIC_API_KEY su Vercel non è valida' })
    } else if (e instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Troppe richieste in poco tempo: riprova fra un minuto' })
    } else if (e instanceof Anthropic.BadRequestError) {
      res.status(400).json({ error: 'Il file non è stato accettato: ' + e.message })
    } else if (e instanceof Anthropic.APIConnectionError) {
      res.status(504).json({ error: 'La lettura ha impiegato troppo tempo: riprova, o usa una foto più piccola' })
    } else if (e instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Errore del servizio di lettura (${e.status})` })
    } else {
      res.status(500).json({ error: 'Lettura non riuscita: ' + e.message })
    }
  }
}

// la lettura di un foglio può richiedere qualche decina di secondi
module.exports.config = { maxDuration: 60 }
