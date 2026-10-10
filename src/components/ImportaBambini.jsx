import { useMemo, useRef, useState } from 'react'
import { readSheet } from 'read-excel-file/universal'
import { supabase } from '../lib/supabase'
import Icon from './Icon'

// Importazione di un elenco di bambini da foto, PDF, Excel o CSV.
// Il file viene letto e trasformato in righe che si possono correggere,
// spuntare o scartare: nel database finisce solo quello che si conferma.

const LATO_MAX = 2200          // le foto del telefono vengono rimpicciolite prima dell'invio
const MAX_PDF = 3 * 1024 * 1024

const pulisci = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
const chiave = (cognome, nome) => `${pulisci(cognome)}|${pulisci(nome)}`.toLowerCase()

// "DI BELLA" -> "Di Bella", "D'AMICO" -> "D'Amico"
const maiuscole = (v) => pulisci(v).toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())

const dataISO = (v) => {
  if (!v) return ''
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  }
  const s = pulisci(v)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/)
  if (!m) return ''
  const anno = m[3].length === 2 ? (Number(m[3]) > 40 ? '19' : '20') + m[3] : m[3]
  return `${anno}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// CSV con virgola o punto e virgola, campi tra virgolette compresi
const leggiCSV = (testo) => {
  const prima = testo.split(/\r?\n/)[0] || ''
  const sep = (prima.match(/;/g) || []).length > (prima.match(/,/g) || []).length ? ';' : ','
  const righe = []
  let riga = [], campo = '', tra = false
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    if (tra) {
      if (c === '"' && testo[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') tra = false
      else campo += c
    } else if (c === '"') tra = true
    else if (c === sep) { riga.push(campo); campo = '' }
    else if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo !== '' || riga.length) { riga.push(campo); righe.push(riga) }
  return righe
}

// Da una tabella (Excel o CSV) alle righe dei bambini. Cerca la riga delle
// intestazioni; se non c'è, assume l'ordine del foglio cartaceo.
const daTabella = (tabella) => {
  const righe = tabella.filter(r => r && r.some(c => pulisci(c) !== ''))
  const iIntest = righe.slice(0, 15).findIndex(r => r.some(c => /cognome/i.test(pulisci(c))))
  let col
  if (iIntest >= 0) {
    const t = righe[iIntest].map(c => pulisci(c).toLowerCase())
    const trova = (re, non) => t.findIndex(x => re.test(x) && !(non && non.test(x)))
    col = {
      cognome: trova(/cognome/), nome: trova(/nome/, /cognome/), data: trova(/data|nascita|nato/),
      indirizzo: trova(/indirizzo|via|residenza/), telefono: trova(/tel|cell/),
    }
  } else {
    const numerata = righe.slice(0, 5).every(r => /^\d*$/.test(pulisci(r[0])))
    const s = numerata ? 1 : 0
    col = { cognome: s, nome: s + 1, data: s + 2, indirizzo: s + 3, telefono: s + 4 }
  }
  const cella = (r, i) => (i >= 0 ? r[i] : '')
  return righe.slice(iIntest + 1).map(r => ({
    cognome: maiuscole(cella(r, col.cognome)), nome: maiuscole(cella(r, col.nome)),
    data_nascita: dataISO(cella(r, col.data)), indirizzo: pulisci(cella(r, col.indirizzo)),
    telefono: pulisci(cella(r, col.telefono)), cancellato: false, incerto: false, nota: '',
  })).filter(b => b.cognome || b.nome)
}

const base64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1])
  r.onerror = () => ko(new Error('File non leggibile'))
  r.readAsDataURL(blob)
})

// Rimpicciolisce la foto: resta leggibile ma pesa una frazione dell'originale
const preparaFoto = async (file) => {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
  const scala = Math.min(1, LATO_MAX / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scala)
  canvas.height = Math.round(img.height * scala)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85))
  return base64(blob)
}

export default function ImportaBambini({ classi, esistenti, classeIniziale, onChiudi, onFatto, toast }) {
  const [fase, setFase] = useState('scelta')   // scelta | lettura | controllo
  const [classeId, setClasseId] = useState(classeIniziale || '')
  const [righe, setRighe] = useState([])
  const [nomeFile, setNomeFile] = useState('')
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef(null)

  const giaPresenti = useMemo(() => {
    const m = {}
    esistenti.forEach(b => { m[chiave(b.cognome, b.nome)] = b.classi?.nome || 'senza classe' })
    return m
  }, [esistenti])

  const leggi = async (file) => {
    if (!file) return
    setErrore(''); setNomeFile(file.name); setFase('lettura')
    try {
      const nome = file.name.toLowerCase()
      let trovati
      if (nome.endsWith('.xlsx')) {
        trovati = daTabella(await readSheet(file))
      } else if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
        trovati = daTabella(leggiCSV(await file.text()))
      } else if (nome.endsWith('.xls')) {
        throw new Error('Il vecchio formato .xls non è supportato: salvalo come .xlsx e riprova')
      } else {
        const pdf = file.type === 'application/pdf' || nome.endsWith('.pdf')
        if (pdf && file.size > MAX_PDF) throw new Error('PDF troppo grande (massimo 3 MB): importa una pagina alla volta')
        if (!pdf && !file.type.startsWith('image/')) throw new Error('Formato non riconosciuto: usa una foto, un PDF, un file Excel (.xlsx) o CSV')
        const dati = pdf ? await base64(file) : await preparaFoto(file)
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/importa-bambini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ mediaType: pdf ? 'application/pdf' : 'image/jpeg', dati }),
        })
        const corpo = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(corpo.error || `Lettura non riuscita (errore ${r.status})`)
        trovati = (corpo.bambini || []).map(b => ({
          ...b, cognome: maiuscole(b.cognome), nome: maiuscole(b.nome), data_nascita: dataISO(b.data_nascita),
        }))
      }
      if (!trovati.length) throw new Error('Nel file non ho trovato nessun nome')

      const visti = new Set()
      setRighe(trovati.map((b, i) => {
        const k = chiave(b.cognome, b.nome)
        const presente = giaPresenti[k]
        const ripetuto = visti.has(k)
        visti.add(k)
        return { ...b, id: i, presente, ripetuto, sel: !b.cancellato && !presente && !ripetuto && !!(b.cognome && b.nome) }
      }))
      setFase('controllo')
    } catch (e) {
      setErrore(e.message || 'Lettura non riuscita')
      setFase('scelta')
    }
  }

  const cambia = (id, campo, valore) =>
    setRighe(rr => rr.map(r => r.id === id ? { ...r, [campo]: valore } : r))

  const scelte = righe.filter(r => r.sel)
  const incomplete = scelte.filter(r => !pulisci(r.cognome) || !pulisci(r.nome))

  const importa = async () => {
    if (!classeId) return toast('Scegli la classe in cui inserirli', 'error')
    if (incomplete.length) return toast('Ci sono righe spuntate senza nome o cognome', 'error')
    setSalvando(true)
    const { data, error } = await supabase.from('bambini').insert(scelte.map(r => ({
      cognome: pulisci(r.cognome), nome: pulisci(r.nome), data_nascita: r.data_nascita || null,
      indirizzo: pulisci(r.indirizzo) || null, telefono1: pulisci(r.telefono) || null,
      classe_id: classeId, attivo: true,
    }))).select('id')
    setSalvando(false)
    if (error || !data?.length) return toast('Importazione non riuscita: ' + (error?.message || 'permessi insufficienti'), 'error', 8000)
    toast(`${data.length} bambini importati`, 'success')
    onFatto()
  }

  const etichetta = (r) =>
    r.cancellato ? ['cancellato sul foglio', 'badge-red']
    : r.presente ? [`già presente (${r.presente})`, 'badge-gray']
    : r.ripetuto ? ['ripetuto nel file', 'badge-gray']
    : r.incerto ? ['da controllare', 'badge-gold']
    : null

  return (
    <div className="modal-overlay" onClick={salvando ? undefined : onChiudi}>
      <div className="modal" onClick={e => e.stopPropagation()} style={fase === 'controllo' ? { maxWidth: 920, width: '100%' } : undefined}>
        <div className="modal-handle" />
        <div className="modal-title">Importa bambini</div>

        {fase === 'scelta' && (
          <>
            <p className="text-sm text-muted" style={{ marginBottom: 14, lineHeight: 1.6 }}>
              Carica la <b>foto</b> o il <b>PDF</b> di un elenco, oppure un file <b>Excel</b> (.xlsx) o <b>CSV</b>.
              Prima di salvare vedi i nomi trovati e puoi correggerli o scartarli.
            </p>
            {errore && (
              <div style={{ background: 'var(--red-bg)', color: '#8f5641', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: '0.85rem', lineHeight: 1.5 }}>
                {errore}
              </div>
            )}
            <input ref={inputRef} type="file" hidden
              accept="image/*,application/pdf,.pdf,.xlsx,.csv"
              onChange={e => { leggi(e.target.files?.[0]); e.target.value = '' }} />
            <button className="btn btn-primary btn-block" onClick={() => inputRef.current?.click()} style={{ gap: 8, marginBottom: 10 }}>
              <Icon name="importa" size={17} /> Scegli il file o scatta una foto
            </button>
            <button className="btn btn-outline btn-block" onClick={onChiudi}>Annulla</button>
          </>
        )}

        {fase === 'lettura' && (
          <div style={{ textAlign: 'center', padding: '26px 0' }}>
            <div className="loader"><div className="spinner" /></div>
            <div className="text-sm" style={{ marginTop: 10, fontWeight: 700 }}>Sto leggendo {nomeFile}…</div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>Per foto e PDF può volerci fino a un minuto.</div>
          </div>
        )}

        {fase === 'controllo' && (
          <>
            <div className="form-group">
              <label className="form-label">Classe in cui inserirli *</label>
              <select className="form-control" value={classeId} onChange={e => setClasseId(e.target.value)}>
                <option value="">Scegli la classe…</option>
                {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="text-xs text-muted" style={{ marginBottom: 8, lineHeight: 1.6 }}>
              Trovati {righe.length} nomi in <b>{nomeFile}</b>. Controlla i dati, correggi dove serve e lascia la spunta solo a chi vuoi importare.
            </div>

            <div style={{ maxHeight: '48vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, paddingRight: 2 }}>
              {righe.map(r => {
                const tag = etichetta(r)
                return (
                  <div key={r.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 10, background: r.sel ? '#fff' : 'var(--gray-50)', opacity: r.sel ? 1 : 0.75 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', flexWrap: 'wrap' }}>
                      <input type="checkbox" checked={r.sel} onChange={e => cambia(r.id, 'sel', e.target.checked)} style={{ width: 18, height: 18 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>{r.cognome} {r.nome}</span>
                      {tag && <span className={`badge ${tag[1]}`}>{tag[0]}</span>}
                    </label>
                    {r.nota && <div className="text-xs text-muted" style={{ marginBottom: 8 }}>{r.nota}</div>}
                    {r.sel && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
                        <input className="form-control" value={r.cognome} onChange={e => cambia(r.id, 'cognome', e.target.value)} placeholder="Cognome" aria-label="Cognome" />
                        <input className="form-control" value={r.nome} onChange={e => cambia(r.id, 'nome', e.target.value)} placeholder="Nome" aria-label="Nome" />
                        <input className="form-control" type="date" value={r.data_nascita} onChange={e => cambia(r.id, 'data_nascita', e.target.value)} aria-label="Data di nascita" />
                        <input className="form-control" value={r.telefono} onChange={e => cambia(r.id, 'telefono', e.target.value)} placeholder="Telefono" aria-label="Telefono" />
                        <input className="form-control" value={r.indirizzo} onChange={e => cambia(r.id, 'indirizzo', e.target.value)} placeholder="Indirizzo" aria-label="Indirizzo" style={{ gridColumn: '1 / -1' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => { setFase('scelta'); setRighe([]) }} disabled={salvando}>Altro file</button>
              <button className="btn btn-primary btn-block" onClick={importa} disabled={salvando || scelte.length === 0}>
                {salvando ? 'Importazione…' : `Importa ${scelte.length} ${scelte.length === 1 ? 'bambino' : 'bambini'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
