import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'

// PIN di accesso. Si cambia da Vercel (variabile REACT_APP_ARCHIVIO_PIN)
// senza toccare il codice. NON e' una protezione dei dati: quella la fanno
// i permessi sul database. Serve solo a evitare aperture per sbaglio.
const PIN = process.env.REACT_APP_ARCHIVIO_PIN || '1948'

export default function Archivio() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()

  const puoEntrare = ['admin', 'parroco', 'responsabile_coro'].some(r => tuttiRuoli.includes(r))
    || tuttiRuoli.includes('archivio')

  const [sbloccato, setSbloccato] = useState(false)
  const [pinDigitato, setPinDigitato] = useState('')
  const [errorePin, setErrorePin] = useState(false)

  const [file, setFile] = useState([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [caricando, setCaricando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { if (sbloccato) carica() }, [sbloccato])

  const carica = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('archivio_file')
      .select('id, titolo, descrizione, file_url, dimensione, created_at')
      .order('titolo', { ascending: true })
    if (error) toast('Errore: ' + error.message, 'error')
    setFile(data || [])
    setLoading(false)
  }

  const verificaPin = () => {
    if (pinDigitato === PIN) { setSbloccato(true); setErrorePin(false) }
    else { setErrorePin(true); setPinDigitato('') }
  }

  // Carica uno o piu' PDF: ognuno prende un nome interno univoco su R2
  const onFile = async (e) => {
    const scelti = Array.from(e.target.files || [])
    if (scelti.length === 0) return
    setCaricando(true)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setCaricando(false); return toast('Sessione scaduta, rifai il login', 'error') }

    let ok = 0
    for (let i = 0; i < scelti.length; i++) {
      const f = scelti[i]
      setProgresso(`${i + 1} di ${scelti.length}: ${f.name}`)

      if (f.type !== 'application/pdf') { toast(`${f.name} non e' un PDF`, 'error'); continue }
      if (f.size > 20 * 1024 * 1024) { toast(`${f.name} supera i 20 MB`, 'error'); continue }

      const id = crypto.randomUUID()
      try {
        const resp = await fetch('/api/canti-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cantoId: id }),
        })
        if (!resp.ok) { toast(`${f.name}: preparazione fallita`, 'error'); continue }
        const { uploadUrl, publicUrl } = await resp.json()

        const put = await fetch(uploadUrl, {
          method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: f,
        })
        if (!put.ok) { toast(`${f.name}: caricamento fallito`, 'error'); continue }

        const titolo = f.name.replace(/\.pdf$/i, '')
        const { error } = await supabase.from('archivio_file').insert({
          titolo, file_url: publicUrl, dimensione: f.size, autore_id: profilo.id,
        })
        if (error) { toast(`${f.name}: ${error.message}`, 'error'); continue }
        ok++
      } catch (err) {
        toast(`${f.name}: ${err.message}`, 'error')
      }
    }

    setCaricando(false); setProgresso(''); e.target.value = ''
    if (ok > 0) toast(`${ok} file caricat${ok === 1 ? 'o' : 'i'}`, 'success')
    carica()
  }

  const elimina = async (f) => {
    if (!window.confirm(`Eliminare "${f.titolo}"?`)) return
    const id = (f.file_url || '').split('/').pop()?.replace('.pdf', '')
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token && id) {
      await fetch('/api/canti-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ cantoId: id }),
      }).catch(() => {})
    }
    const { error } = await supabase.from('archivio_file').delete().eq('id', f.id)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast('File eliminato', 'success'); carica()
  }

  const rinomina = async (f) => {
    const nuovo = window.prompt('Nuovo titolo:', f.titolo)
    if (!nuovo || nuovo === f.titolo) return
    const { error } = await supabase.from('archivio_file').update({ titolo: nuovo.trim() }).eq('id', f.id)
    if (error) return toast('Errore: ' + error.message, 'error')
    carica()
  }

  const fmtPeso = (b) => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'

  // ── Accesso negato dal ruolo ───────────────────────────────
  if (!puoEntrare) {
    return <div style={{ padding: 16 }}><div className="empty-state">
      <Icon name="canti" size={44} style={{ color: 'var(--gray-300)' }} />
      <p style={{ marginTop: 12 }}>Questo archivio &egrave; riservato.</p>
    </div></div>
  }

  // ── Schermata del PIN ──────────────────────────────────────
  if (!sbloccato) {
    return (
      <div style={{ padding: 16, maxWidth: 380, margin: '40px auto 0' }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ width: 58, height: 58, borderRadius: 16, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="canti" size={28} />
            </div>
            <h2 style={{ marginBottom: 6 }}>Archivio spartiti</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 20 }}>
              Inserisci il PIN per entrare.
            </p>

            <input
              type="password"
              inputMode="numeric"
              className="form-control"
              value={pinDigitato}
              onChange={e => { setPinDigitato(e.target.value); setErrorePin(false) }}
              onKeyDown={e => e.key === 'Enter' && verificaPin()}
              placeholder="PIN"
              autoFocus
              style={{
                textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em',
                borderColor: errorePin ? 'var(--red)' : undefined,
              }}
            />
            {errorePin && (
              <div className="text-sm" style={{ color: 'var(--red)', marginTop: 9, fontWeight: 700 }}>
                PIN errato
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} onClick={verificaPin}>
              Entra
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Archivio ───────────────────────────────────────────────
  const filtrati = file.filter(f =>
    (f.titolo + ' ' + (f.descrizione || '')).toLowerCase().includes(cerca.toLowerCase()))

  // raggruppa per iniziale
  const gruppi = {}
  filtrati.forEach(f => {
    const L = (f.titolo[0] || '#').toUpperCase()
    if (!gruppi[L]) gruppi[L] = []
    gruppi[L].push(f)
  })
  const lettere = Object.keys(gruppi).sort()

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <ToastContainer />
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={onFile} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1>Archivio spartiti</h1>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            {file.length} file &middot; in ordine alfabetico
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ gap: 6 }} disabled={caricando} onClick={() => inputRef.current?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V7" /><path d="M8 11l4-4 4 4" /><path d="M4 21h16" /></svg>
          {caricando ? 'Carico...' : 'Carica PDF'}
        </button>
      </div>

      {caricando && progresso && (
        <div className="card" style={{ marginBottom: 14, background: 'var(--primary-bg)', border: 'none' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="spinner" />
            <span className="text-sm" style={{ fontWeight: 700 }}>{progresso}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 11, marginBottom: 16 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input placeholder="Cerca uno spartito..." value={cerca} onChange={e => setCerca(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Nunito, sans-serif', fontSize: '0.9rem', background: 'transparent', color: 'var(--gray-900)' }} />
        {cerca && (
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCerca('')} aria-label="Pulisci">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> :
        filtrati.length === 0 ? (
          <div className="empty-state">
            <Icon name="canti" size={44} style={{ color: 'var(--gray-300)' }} />
            <p style={{ marginTop: 12 }}>
              {cerca ? 'Nessuno spartito trovato.' : 'Archivio vuoto. Carica il primo PDF con il pulsante in alto.'}
            </p>
          </div>
        ) : lettere.map(L => (
          <div key={L}>
            <div className="grp-head">
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>{L}</span>
              <span className="n">{gruppi[L].length}</span>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {gruppi[L].map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < gruppi[L].length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--blue-bg)', color: '#4c6478', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.titolo}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>{fmtPeso(f.dimensione)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <a href={f.file_url} target="_blank" rel="noreferrer">
                      <button className="btn btn-outline btn-sm btn-icon" aria-label="Apri">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></svg>
                      </button>
                    </a>
                    <button className="btn btn-outline btn-sm btn-icon" aria-label="Rinomina" onClick={() => rinomina(f)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                    </button>
                    <button className="btn btn-red btn-sm btn-icon" aria-label="Elimina" onClick={() => elimina(f)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}
