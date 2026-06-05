import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const MOMENTI = [
  'Ingresso','Kyrie','Gloria','Salmo','Alleluia',
  'Offertorio','Santo','Agnello di Dio','Comunione',
  'Ringraziamento','Uscita','Adorazione','Mariano','Altro',
]
const TEMPI = ['Avvento','Natale','Quaresima','Pasqua','Tempo Ordinario','Feste Mariane','Feste dei Santi']
const SEZIONI = ['Ritornello','Strofa 1','Strofa 2','Strofa 3','Bridge','Intro','Coda','Fine']

const MOMENTO_COLOR = {
  'Ingresso':'#1565c0','Kyrie':'#0891b2','Gloria':'#d97706',
  'Salmo':'#059669','Alleluia':'#16a34a','Offertorio':'#f59e0b',
  'Santo':'#2563eb','Agnello di Dio':'#7c3aed','Comunione':'#1a6b3c',
  'Ringraziamento':'#0d6b3c','Uscita':'#c62828','Adorazione':'#7c3aed',
  'Mariano':'#db2777','Altro':'#6b7280',
}

// Toolbar accordi organizzata a tab
const ACCORDI_GRUPPI = [
  { label:'Magg.', col:'#1a6b3c',  list:['Do','Re','Mi','Fa','Sol','La','Si'] },
  { label:'Min.',  col:'#1565c0',  list:['Dom','Rem','Mim','Fam','Solm','Lam','Sim'] },
  { label:'Sett.', col:'#d97706',  list:['Do7','Re7','Mi7','Fa7','Sol7','La7','Si7'] },
  { label:'Alt.',  col:'#7c3aed',  list:['Do#','Re#','Fa#','Sol#','La#','Sib','Mib','Lab'] },
]

// ── Trasposizione ────────────────────────────────────────────────
const SCALA = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si']
const BEMOLLI = { 'Sib':'La#','Mib':'Re#','Lab':'Sol#','Reb':'Do#','Solb':'Fa#' }
// radici ordinate dalla più lunga per evitare match parziale
const RADICI_ORDER = [...Object.keys(BEMOLLI),'Sol#','Do#','Re#','Fa#','La#','Sol','Do','Re','Mi','Fa','La','Si']
  .sort((a,b) => b.length - a.length)

function parseAccordo(str) {
  for (const r of RADICI_ORDER) {
    if (str.startsWith(r)) return { radice: BEMOLLI[r] || r, qualita: str.slice(r.length) }
  }
  return null
}

export function trasponiAccordo(acc, semitoni) {
  const p = parseAccordo(acc)
  if (!p) return acc
  const idx = SCALA.indexOf(p.radice)
  if (idx === -1) return acc
  return SCALA[((idx + semitoni) % 12 + 12) % 12] + p.qualita
}

function trasponiTesto(testo, semitoni) {
  if (!semitoni || !testo) return testo
  return testo.replace(/\[([^\]]+)\]/g, (_, a) => `[${trasponiAccordo(a, semitoni)}]`)
}

const vuotoForm = { titolo:'', categoria:'', tonalita:'', tempo_liturgico:'', testo:'' }

// ── Parsing per editor click-to-chord ───────────────────────────
function parseTesto(testo) {
  if (!testo) return { linee: [], map: {} }
  const map = {}
  const linee = testo.split('\n').map((riga, li) => {
    if (riga.startsWith('## ')) return { type: 'section', text: riga.slice(3) }
    if (!riga.trim()) return { type: 'empty' }
    const words = []
    let wi = 0, i = 0, pendingChord = null
    while (i < riga.length) {
      if (riga[i] === '[') {
        const end = riga.indexOf(']', i)
        if (end !== -1) { pendingChord = riga.slice(i+1, end); i = end+1; continue }
      }
      if (riga[i] === ' ' || riga[i] === '\t') {
        let sp = ''
        while (i < riga.length && (riga[i] === ' ' || riga[i] === '\t')) sp += riga[i++]
        words.push({ id: `${li}-s${wi}`, text: sp, isSpace: true })
      } else {
        let word = ''
        while (i < riga.length && riga[i] !== ' ' && riga[i] !== '\t' && riga[i] !== '[') word += riga[i++]
        if (word) {
          const id = `${li}-${wi}`
          if (pendingChord) { map[id] = pendingChord; pendingChord = null }
          words.push({ id, text: word, isSpace: false })
          wi++
        }
      }
    }
    return { type: 'words', words }
  })
  return { linee, map }
}

function ricostruisciTesto(linee, map) {
  return linee.map(l => {
    if (l.type === 'section') return `## ${l.text}`
    if (l.type === 'empty') return ''
    return l.words.map(w => w.isSpace ? w.text : (map[w.id] ? `[${map[w.id]}]${w.text}` : w.text)).join('')
  }).join('\n')
}

// ── Rendering professionale: accordi sopra le parole ────────────
function TestoFormattato({ testo, fontSize = 15 }) {
  if (!testo) return null
  return (
    <div style={{ fontSize, userSelect:'text' }}>
      {testo.split('\n').map((riga, i) => {
        if (riga.startsWith('## ')) {
          return (
            <div key={i} style={{
              fontFamily:'Nunito, sans-serif', fontWeight:800, color:'var(--primary)',
              marginTop:22, marginBottom:6, fontSize:fontSize*0.72,
              textTransform:'uppercase', letterSpacing:'0.12em',
              borderBottom:'2px solid var(--primary-bg)', paddingBottom:4,
            }}>
              § {riga.slice(3)}
            </div>
          )
        }
        if (!riga.trim()) return <div key={i} style={{ height:12 }} />

        if (!riga.includes('[')) {
          return (
            <div key={i} style={{ display:'flex', flexWrap:'wrap', marginBottom:4 }}>
              <span style={{ display:'inline-block', whiteSpace:'pre' }}>
                <div style={{ minHeight: fontSize * 1.1 }} />
                <div style={{ lineHeight:1.7, fontFamily:'Georgia, serif', fontSize }}>{riga}</div>
              </span>
            </div>
          )
        }

        // Parse accordi inline → blocchi {acc, txt}
        const parti = []
        const re = /\[([^\]]+)\]/g
        let last = 0, m
        while ((m = re.exec(riga)) !== null) {
          if (m.index > last) parti.push({ t:'txt', v: riga.slice(last, m.index) })
          parti.push({ t:'acc', v: m[1] })
          last = m.index + m[0].length
        }
        if (last < riga.length) parti.push({ t:'txt', v: riga.slice(last) })

        // Unisci ogni accordo al testo che lo segue
        const blocchi = []
        let pi = 0
        while (pi < parti.length) {
          if (parti[pi].t === 'acc') {
            const acc = parti[pi].v
            let txt = '  '
            if (pi+1 < parti.length && parti[pi+1].t === 'txt') {
              txt = parti[pi+1].v || '  '
              pi += 2
            } else { pi++ }
            blocchi.push({ acc, txt })
          } else {
            blocchi.push({ acc: null, txt: parti[pi].v })
            pi++
          }
        }

        return (
          <div key={i} style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', marginBottom:6 }}>
            {blocchi.map((b, j) => (
              <span key={j} style={{ display:'inline-block', whiteSpace:'pre' }}>
                <div style={{
                  fontFamily:'Nunito, monospace', fontWeight:900,
                  color:'#1565c0', fontSize: fontSize * 0.8,
                  lineHeight:1, minHeight: fontSize * 1.15,
                  letterSpacing:'0.01em',
                }}>
                  {b.acc || ''}
                </div>
                <div style={{ lineHeight:1.65, fontFamily:'Georgia, serif', fontSize }}>{b.txt}</div>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function Canti() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isResp = ['admin','parroco','responsabile_coro'].includes(profilo?.ruolo)

  const [canti, setCanti] = useState([])
  const [loading, setLoading] = useState(true)
  const [cantoAttivo, setCantoAttivo] = useState(null)

  const [vistaModal, setVistaModal] = useState(null)
  const [modal, setModal] = useState(null)
  const [vistaPdf, setVistaPdf] = useState(false)

  const [tipoIns, setTipoIns] = useState('testo')
  const [form, setForm] = useState(vuotoForm)
  const [pdfFile, setPdfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [fontSize, setFontSize] = useState(15)
  const [transposeOffset, setTransposeOffset] = useState(0)
  const [tabAccordi, setTabAccordi] = useState(0)
  // Editor click-to-chord
  const [modoEditor, setModoEditor] = useState('testo') // 'testo' | 'accordi'
  const [lineeParole, setLineeParole] = useState([])
  const [accordiMap, setAccordiMap] = useState({})
  const [wordAttiva, setWordAttiva] = useState(null)

  const [uploadingPdf, setUploadingPdf] = useState(null)
  const pdfInputRef = useRef(null)
  const pdfInputNuovoRef = useRef(null)
  const pdfTargetRef = useRef(null)
  const textareaRef = useRef(null)

  const [cerca, setCerca] = useState('')
  const [filtroMomento, setFiltroMomento] = useState('')
  const [filtroTempo, setFiltroTempo] = useState('')

  const cantiRef       = useRef([])
  const cantoAttivoRef = useRef(null)
  const lanciatoQuiRef = useRef(false)
  useEffect(() => { cantiRef.current       = canti       }, [canti])
  useEffect(() => { cantoAttivoRef.current = cantoAttivo }, [cantoAttivo])

  useEffect(() => { caricaCanti(); caricaCantoAttivo() }, [])

  useEffect(() => {
    const poll = async () => {
      if (lanciatoQuiRef.current) return
      const { data } = await supabase.from('canto_attivo').select('canto_id').eq('id', 1).maybeSingle()
      const nuovoId = data?.canto_id ?? null
      if (nuovoId === cantoAttivoRef.current) return
      setCantoAttivo(nuovoId)
      if (nuovoId) {
        let c = cantiRef.current.find(x => x.id === nuovoId)
        if (!c) {
          const { data: tutti } = await supabase.from('canti').select('*').order('categoria').order('titolo')
          if (tutti) { setCanti(tutti); cantiRef.current = tutti }
          c = (tutti || []).find(x => x.id === nuovoId)
        }
        if (c) { setVistaModal(c); setVistaPdf(!!c.pdf_url && !c.testo); setTransposeOffset(0) }
      } else {
        setVistaModal(null)
      }
    }
    const timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fn = (e) => {
      if (e.key !== 'Escape') return
      if (modal) setModal(null)
      else if (vistaModal) setVistaModal(null)
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [modal, vistaModal])

  const caricaCanti = async () => {
    const { data } = await supabase.from('canti').select('*').order('categoria').order('titolo')
    setCanti(data || [])
    setLoading(false)
  }

  const caricaCantoAttivo = async () => {
    const { data } = await supabase.from('canto_attivo').select('canto_id').eq('id', 1).maybeSingle()
    setCantoAttivo(data?.canto_id ?? null)
  }

  const lancia = async (cantoId) => {
    const stop = cantoAttivo === cantoId
    const nuovoId = stop ? null : cantoId
    lanciatoQuiRef.current = true
    const { error } = await supabase.from('canto_attivo').update({
      canto_id: nuovoId, lanciato_da: profilo?.id, lanciato_at: new Date().toISOString(),
    }).eq('id', 1)
    if (error) {
      lanciatoQuiRef.current = false
      toast('Errore lancio: ' + error.message, 'error', 8000)
      return
    }
    setCantoAttivo(nuovoId)
    setTimeout(() => { lanciatoQuiRef.current = false }, 7000)
    if (stop) toast('Canto fermato', 'default')
    else toast(`🎵 ${canti.find(c => c.id === cantoId)?.titolo}`, 'success')
  }

  const resetEditorState = () => {
    setModoEditor('testo'); setLineeParole([]); setAccordiMap({}); setWordAttiva(null)
    setShowPreview(false); setTabAccordi(0)
  }

  const apriNuovo = () => {
    setForm(vuotoForm); setTipoIns('testo'); setPdfFile(null)
    resetEditorState(); setModal('nuovo')
  }
  const apriModifica = (c) => {
    setForm({ titolo:c.titolo||'', categoria:c.categoria||'', tonalita:c.tonalita||'',
      tempo_liturgico:c.tempo_liturgico||'', testo:c.testo||'' })
    setTipoIns(c.testo ? 'testo' : 'pdf')
    setPdfFile(null); resetEditorState(); setModal(c)
  }

  const entraChordsMode = () => {
    const { linee, map } = parseTesto(form.testo)
    setLineeParole(linee); setAccordiMap(map); setWordAttiva(null)
    setModoEditor('accordi')
  }
  const tornaTestoMode = () => {
    const testo = ricostruisciTesto(lineeParole, accordiMap)
    setForm(f => ({...f, testo})); setWordAttiva(null); setModoEditor('testo')
  }

  const salva = async () => {
    if (!form.titolo.trim()) return toast('Inserisci il titolo','error')
    if (tipoIns === 'pdf' && modal === 'nuovo' && !pdfFile) return toast('Seleziona un file PDF','error')
    setSaving(true)
    // Se siamo in modalità accordi, ricostruiamo il testo prima di salvare
    const testoFinale = (tipoIns === 'testo' && modoEditor === 'accordi')
      ? ricostruisciTesto(lineeParole, accordiMap)
      : form.testo
    const dati = {
      titolo: form.titolo.trim(), categoria: form.categoria || null,
      tonalita: form.tonalita || null, tempo_liturgico: form.tempo_liturgico || null,
      testo: tipoIns === 'testo' ? (testoFinale || null) : null, autore_id: profilo?.id,
    }
    let cantoId
    if (modal === 'nuovo') {
      const { data, error } = await supabase.from('canti').insert(dati).select('id').single()
      if (error) { toast('Errore nel salvataggio','error'); setSaving(false); return }
      cantoId = data.id
    } else {
      const { error } = await supabase.from('canti').update(dati).eq('id', modal.id)
      if (error) { toast('Errore nel salvataggio','error'); setSaving(false); return }
      cantoId = modal.id
    }
    if (pdfFile && cantoId) await uploadPdfFile(pdfFile, cantoId)
    toast(modal === 'nuovo' ? 'Canto aggiunto ✓' : 'Canto aggiornato ✓','success')
    setSaving(false); setModal(null); caricaCanti()
  }

  const uploadPdfFile = async (file, cantoId) => {
    const path = `${cantoId}.pdf`
    const { error } = await supabase.storage.from('canti-pdf').upload(path, file, { upsert:true, contentType:'application/pdf' })
    if (error) { toast('PDF non caricato: ' + error.message,'error'); return }
    const { data: urlData } = supabase.storage.from('canti-pdf').getPublicUrl(path)
    await supabase.from('canti').update({ pdf_url: urlData.publicUrl }).eq('id', cantoId)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo canto?')) return
    await supabase.from('canti').delete().eq('id', id)
    toast('Canto eliminato','success'); caricaCanti()
  }

  const avviaUploadPdf = (id) => { pdfTargetRef.current = id; pdfInputRef.current?.click() }
  const onPdfEsistente = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const cantoId = pdfTargetRef.current
    if (!cantoId || file.type !== 'application/pdf') return toast('Seleziona un PDF','error')
    if (file.size > 20*1024*1024) return toast('File troppo grande (max 20 MB)','error')
    setUploadingPdf(cantoId)
    await uploadPdfFile(file, cantoId)
    setUploadingPdf(null); e.target.value = ''; caricaCanti()
    toast('PDF caricato ✓','success')
  }
  const rimuoviPdf = async (id) => {
    if (!window.confirm('Rimuovere il PDF?')) return
    await supabase.storage.from('canti-pdf').remove([`${id}.pdf`])
    await supabase.from('canti').update({ pdf_url: null }).eq('id', id)
    toast('PDF rimosso','success'); caricaCanti()
  }

  const inserisci = (txt) => {
    const el = textareaRef.current
    if (!el) { setForm(f => ({ ...f, testo: f.testo + txt })); return }
    const s = el.selectionStart, e2 = el.selectionEnd
    const nuovo = form.testo.slice(0, s) + txt + form.testo.slice(e2)
    setForm(f => ({ ...f, testo: nuovo }))
    setTimeout(() => { el.focus(); el.setSelectionRange(s+txt.length, s+txt.length) }, 0)
  }

  const hasFilter = cerca || filtroMomento || filtroTempo
  const cantiFiltrati = canti.filter(c => {
    if (cerca && !`${c.titolo} ${c.categoria||''}`.toLowerCase().includes(cerca.toLowerCase())) return false
    if (filtroMomento && c.categoria !== filtroMomento) return false
    if (filtroTempo && c.tempo_liturgico !== filtroTempo) return false
    return true
  }).sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'))

  const cantiRaggruppati = (() => {
    if (filtroMomento || cerca) return null
    const gruppi = {}
    cantiFiltrati.forEach(c => {
      const m = c.categoria || 'Altro'
      if (!gruppi[m]) gruppi[m] = []
      gruppi[m].push(c)
    })
    return MOMENTI.filter(m => gruppi[m]).map(m => ({ momento: m, canti: gruppi[m] }))
      .concat(Object.keys(gruppi).filter(m => !MOMENTI.includes(m)).map(m => ({ momento: m, canti: gruppi[m] })))
  })()

  const renderCanto = (c) => {
    const col = MOMENTO_COLOR[c.categoria] || 'var(--gray-300)'
    const attivo = cantoAttivo === c.id
    return (
      <div key={c.id} className="card" style={{ borderLeft:`3px solid ${attivo ? 'var(--primary)' : col}`, background: attivo ? '#f0faf4' : '#fff' }}>
        <div className="card-body" style={{ padding:'11px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, cursor:'pointer', minWidth:0 }}
              onClick={() => { setVistaModal(c); setVistaPdf(!!c.pdf_url && !c.testo); setTransposeOffset(0) }}>
              <div style={{ fontWeight:800, fontSize:'0.92rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.titolo}</div>
              <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                {c.tonalita && <span className="badge badge-gray" style={{ fontSize:'0.68rem' }}>{c.tonalita}</span>}
                {c.tempo_liturgico && <span className="badge badge-gold" style={{ fontSize:'0.68rem' }}>{c.tempo_liturgico}</span>}
                {c.pdf_url && <span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>📄 PDF</span>}
                {c.testo && <span className="badge badge-green" style={{ fontSize:'0.68rem' }}>✍️ Testo</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:5, flexShrink:0 }}>
              {c.pdf_url && (
                <a href={c.pdf_url} target="_blank" rel="noreferrer">
                  <button className="btn btn-outline btn-sm btn-icon">📄</button>
                </a>
              )}
              {isResp && (
                <>
                  <button className="btn btn-outline btn-sm btn-icon"
                    disabled={uploadingPdf === c.id} onClick={() => avviaUploadPdf(c.id)}>
                    {uploadingPdf === c.id ? <div className="spinner" style={{width:14,height:14}}/> : '⬆'}
                  </button>
                  {c.pdf_url && <button className="btn btn-outline btn-sm btn-icon" onClick={() => rimuoviPdf(c.id)}>✕</button>}
                  <button className="btn btn-sm" onClick={() => lancia(c.id)}
                    style={{ background: attivo ? 'var(--red)' : 'var(--primary)', color:'#fff', fontWeight:800, minWidth:64 }}>
                    {attivo ? '⏹ Stop' : '▶ Lancia'}
                  </button>
                  <button className="btn btn-outline btn-sm btn-icon" onClick={() => apriModifica(c)}>✏️</button>
                  <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(c.id)}>🗑</button>
                </>
              )}
              {!isResp && attivo && <span className="badge badge-green">▶ In corso</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const testoVista = vistaModal?.testo ? trasponiTesto(vistaModal.testo, transposeOffset) : null

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <input ref={pdfInputRef} type="file" accept="application/pdf" style={{display:'none'}} onChange={onPdfEsistente}/>

      <div className="flex items-center justify-between mb-4">
        <h1>🎵 Canti</h1>
        {isResp && <button className="btn btn-primary btn-sm" onClick={apriNuovo}>＋ Aggiungi</button>}
      </div>

      {cantoAttivo && (
        <div style={{ background:'var(--primary)', color:'#fff', padding:'12px 16px', borderRadius:12, marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.3rem' }}>🎵</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:'0.9rem' }}>In corso: {canti.find(c=>c.id===cantoAttivo)?.titolo}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.8 }}>Tap per aprire il testo</div>
          </div>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,0.2)', color:'#fff' }}
            onClick={() => { const c=canti.find(x=>x.id===cantoAttivo); if(c){setVistaModal(c);setVistaPdf(!!c.pdf_url&&!c.testo);setTransposeOffset(0)} }}>
            Apri
          </button>
        </div>
      )}

      {/* Filtri */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="card-body" style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          <input className="form-control" placeholder="🔍 Cerca canto…" value={cerca} onChange={e => setCerca(e.target.value)} />
          <div style={{ overflowX:'auto', paddingBottom:2 }}>
            <div style={{ display:'flex', gap:6, whiteSpace:'nowrap' }}>
              <button onClick={() => setFiltroMomento('')}
                className={filtroMomento==='' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>Tutti</button>
              {MOMENTI.map(m => (
                <button key={m} onClick={() => setFiltroMomento(filtroMomento===m ? '' : m)}
                  className="btn btn-sm"
                  style={{ background: filtroMomento===m ? (MOMENTO_COLOR[m]||'var(--gray-500)') : '#fff',
                    color: filtroMomento===m ? '#fff' : 'var(--gray-700)',
                    border:'1.5px solid', borderColor: filtroMomento===m ? (MOMENTO_COLOR[m]||'var(--gray-300)') : 'var(--gray-200)' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select className="form-control" style={{ fontSize:'0.78rem', padding:'6px 28px 6px 10px', flex:1 }}
              value={filtroTempo} onChange={e => setFiltroTempo(e.target.value)}>
              <option value="">Tutti i tempi liturgici</option>
              {TEMPI.map(t => <option key={t}>{t}</option>)}
            </select>
            {hasFilter && <button className="btn btn-ghost btn-sm" onClick={() => { setCerca(''); setFiltroMomento(''); setFiltroTempo('') }}>✕ Reset</button>}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted" style={{ marginBottom:10, fontWeight:700 }}>{cantiFiltrati.length} canti</div>

      {loading ? (
        <div className="loader"><div className="spinner"/>Caricamento…</div>
      ) : cantiFiltrati.length === 0 ? (
        <div className="empty-state"><div className="icon">🎶</div><p>Nessun canto trovato</p></div>
      ) : cantiRaggruppati ? (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {cantiRaggruppati.map(({ momento, canti: lista }) => (
            <div key={momento}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:6, borderBottom:`2px solid ${MOMENTO_COLOR[momento]||'var(--gray-200)'}` }}>
                <span style={{ fontWeight:800, color:MOMENTO_COLOR[momento]||'var(--gray-500)', fontSize:'0.9rem' }}>{momento}</span>
                <span className="badge badge-gray">{lista.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>{lista.map(renderCanto)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{cantiFiltrati.map(renderCanto)}</div>
      )}

      {/* ══ Modal VISTA CANTO ══ */}
      {vistaModal && (
        <div className="modal-overlay" onClick={() => setVistaModal(null)}>
          <div className="modal" style={{ maxHeight:'93vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>

            {/* Intestazione */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ flex:1, marginRight:8 }}>
                <h2 style={{ fontSize:'1.1rem', lineHeight:1.3, margin:0 }}>{vistaModal.titolo}</h2>
                <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                  {vistaModal.categoria && <span className="badge badge-green">{vistaModal.categoria}</span>}
                  {vistaModal.tonalita && (
                    <span className="badge badge-blue">
                      {vistaModal.tonalita}{transposeOffset !== 0 ? ` → ${trasponiAccordo(vistaModal.tonalita.split(' ')[0], transposeOffset)} ${vistaModal.tonalita.split(' ')[1]||''}` : ''}
                    </span>
                  )}
                  {vistaModal.tempo_liturgico && <span className="badge badge-gold">{vistaModal.tempo_liturgico}</span>}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setVistaModal(null)}>✕</button>
            </div>

            {vistaModal.testo && vistaModal.pdf_url && (
              <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                <button onClick={() => setVistaPdf(false)} className={!vistaPdf ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>✍️ Testo</button>
                <button onClick={() => setVistaPdf(true)} className={vistaPdf ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>📄 PDF</button>
              </div>
            )}

            {/* Toolbar: zoom + trasposizione + lancia */}
            {vistaModal.testo && !vistaPdf && (
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:14, padding:'10px 12px', background:'var(--gray-50)', borderRadius:10, flexWrap:'wrap' }}>
                {/* Zoom */}
                <button onClick={() => setFontSize(s => Math.max(11, s-2))}
                  style={{ width:36, height:36, borderRadius:8, border:'1.5px solid var(--gray-200)', background:'#fff', fontWeight:900, cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}>A−</button>
                <span style={{ fontSize:'0.7rem', color:'var(--gray-400)', fontWeight:700, minWidth:28, textAlign:'center' }}>{fontSize}</span>
                <button onClick={() => setFontSize(s => Math.min(32, s+2))}
                  style={{ width:36, height:36, borderRadius:8, border:'1.5px solid var(--gray-200)', background:'#fff', fontWeight:900, cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}>A+</button>

                <div style={{ width:1, height:24, background:'var(--gray-200)', margin:'0 4px', flexShrink:0 }}/>

                {/* Trasposizione */}
                <button onClick={() => setTransposeOffset(n => n-1)}
                  style={{ width:36, height:36, borderRadius:8, border:'1.5px solid #1565c0', background:'#fff', fontWeight:900, cursor:'pointer', color:'#1565c0', flexShrink:0, fontSize:'1.1rem' }}>♭</button>
                <div style={{ textAlign:'center', minWidth:34, fontSize:'0.75rem', fontWeight:800,
                  color: transposeOffset !== 0 ? '#1565c0' : 'var(--gray-400)',
                  background: transposeOffset !== 0 ? '#e8f0fe' : 'transparent',
                  borderRadius:6, padding:'2px 4px' }}>
                  {transposeOffset === 0 ? 'Ton.' : (transposeOffset > 0 ? `+${transposeOffset}` : `${transposeOffset}`)}
                </div>
                <button onClick={() => setTransposeOffset(n => n+1)}
                  style={{ width:36, height:36, borderRadius:8, border:'1.5px solid #1565c0', background:'#fff', fontWeight:900, cursor:'pointer', color:'#1565c0', flexShrink:0, fontSize:'1.1rem' }}>♯</button>
                {transposeOffset !== 0 && (
                  <button onClick={() => setTransposeOffset(0)}
                    style={{ width:36, height:36, borderRadius:8, border:'1.5px solid var(--gray-200)', background:'#fff', cursor:'pointer', fontSize:'0.9rem', flexShrink:0 }}>↺</button>
                )}

                {isResp && (
                  <>
                    <div style={{ flex:1 }}/>
                    <button className="btn btn-sm" onClick={() => lancia(vistaModal.id)}
                      style={{ background: cantoAttivo===vistaModal.id ? 'var(--red)' : 'var(--primary)', color:'#fff', fontWeight:800, flexShrink:0 }}>
                      {cantoAttivo===vistaModal.id ? '⏹ Stop' : '▶ Lancia'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Contenuto */}
            {!vistaPdf && vistaModal.testo ? (
              <div style={{ overflowY:'auto', maxHeight:'60vh', padding:'2px 4px' }}>
                <TestoFormattato testo={testoVista} fontSize={fontSize}/>
              </div>
            ) : vistaModal.pdf_url ? (
              <div>
                <iframe src={vistaModal.pdf_url + '#toolbar=0&navpanes=0&scrollbar=0'}
                  style={{ width:'100%', height:'60vh', border:'none', borderRadius:8, background:'#f5f5f5' }}
                  title={vistaModal.titolo}/>
                <a href={vistaModal.pdf_url} target="_blank" rel="noreferrer" style={{ display:'block', marginTop:8 }}>
                  <button className="btn btn-outline btn-sm btn-block">↗ Apri in nuova scheda</button>
                </a>
              </div>
            ) : (
              <p className="text-muted text-sm">Nessun testo o PDF disponibile.</p>
            )}
          </div>
        </div>
      )}

      {/* ══ Modal AGGIUNGI / MODIFICA ══ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxHeight:'96vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Canto' : 'Modifica Canto'}</div>

            {modal === 'nuovo' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {[
                  { val:'testo', icon:'✍️', label:'Scrivi testo', sub:'Parole e accordi' },
                  { val:'pdf',   icon:'📄', label:'Carica PDF',   sub:'Scansione o file' },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setTipoIns(opt.val)}
                    style={{ padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                      border:`2px solid ${tipoIns===opt.val ? 'var(--primary)' : 'var(--gray-200)'}`,
                      background: tipoIns===opt.val ? 'var(--primary-bg)' : '#fff' }}>
                    <div style={{ fontSize:'1.5rem', marginBottom:4 }}>{opt.icon}</div>
                    <div style={{ fontWeight:800, fontSize:'0.82rem', color: tipoIns===opt.val ? 'var(--primary)' : 'var(--gray-700)' }}>{opt.label}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--gray-500)', marginTop:2 }}>{opt.sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-control" value={form.titolo}
                onChange={e => setForm(f=>({...f,titolo:e.target.value}))} placeholder="Es: Tu sei la mia vita"/>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Momento liturgico</label>
                <select className="form-control" value={form.categoria} onChange={e => setForm(f=>({...f,categoria:e.target.value}))}>
                  <option value="">— Nessuno —</option>
                  {MOMENTI.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tonalità</label>
                <select className="form-control" value={form.tonalita} onChange={e => setForm(f=>({...f,tonalita:e.target.value}))}>
                  <option value="">— —</option>
                  {['Do M','Re M','Mi M','Fa M','Sol M','La M','Si M','Do m','Re m','Mi m','Fa m','Sol m','La m','Si m'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tempo liturgico</label>
              <select className="form-control" value={form.tempo_liturgico} onChange={e => setForm(f=>({...f,tempo_liturgico:e.target.value}))}>
                <option value="">Tutto l'anno</option>
                {TEMPI.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {tipoIns === 'testo' && (
              <div className="form-group">
                {/* Header con toggle modo */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <label className="form-label" style={{ margin:0 }}>Testo e accordi</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {modoEditor === 'testo' && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPreview(v=>!v)}>
                        {showPreview ? '✏️ Editor' : '👁 Anteprima'}
                      </button>
                    )}
                    {modoEditor === 'testo' && !showPreview && (
                      <button type="button" className="btn btn-sm"
                        onClick={entraChordsMode}
                        style={{ background:'#1565c0', color:'#fff', fontWeight:700, fontSize:'0.78rem', padding:'4px 10px', borderRadius:8 }}
                        disabled={!form.testo.trim()}>
                        🎸 Accordi
                      </button>
                    )}
                    {modoEditor === 'accordi' && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={tornaTestoMode}>
                        ← Testo
                      </button>
                    )}
                  </div>
                </div>

                {/* MODO TESTO */}
                {modoEditor === 'testo' && !showPreview && (
                  <>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:'0.67rem', fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>Sezioni</div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {SEZIONI.map(s => (
                          <button key={s} type="button" onClick={() => inserisci(`\n## ${s}\n`)}
                            style={{ padding:'4px 9px', borderRadius:6, border:'1.5px solid var(--primary)',
                              background:'var(--primary-bg)', color:'var(--primary)', fontWeight:700, fontSize:'0.72rem', cursor:'pointer' }}>
                            § {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted" style={{ marginBottom:8 }}>
                      Incolla/scrivi il testo, poi clicca <strong>🎸 Accordi</strong> per posizionarli graficamente.
                    </div>
                    <textarea ref={textareaRef} className="form-control" rows={10}
                      value={form.testo}
                      onChange={e => setForm(f=>({...f,testo:e.target.value}))}
                      placeholder={'Incolla qui il testo del canto...\n\n## Ritornello\nTu sei la mia vita...\n\n## Strofa 1\nNel cammino insieme...'}
                      style={{ fontFamily:'monospace', fontSize:13, lineHeight:1.7 }}/>
                  </>
                )}

                {modoEditor === 'testo' && showPreview && (
                  <div style={{ border:'1.5px solid var(--gray-200)', borderRadius:10, padding:'16px', minHeight:200, background:'#fdfcfb', overflowY:'auto', maxHeight:340 }}>
                    {form.testo
                      ? <TestoFormattato testo={form.testo} fontSize={14}/>
                      : <p className="text-muted text-sm" style={{ fontStyle:'italic' }}>Scrivi il testo nell'editor per vedere l'anteprima…</p>}
                  </div>
                )}

                {/* MODO ACCORDI: click-to-place */}
                {modoEditor === 'accordi' && (
                  <>
                    <div className="text-xs text-muted" style={{ marginBottom:8, padding:'6px 10px', background:'#e8f0fe', borderRadius:8, color:'#1565c0', fontWeight:600 }}>
                      Tocca una parola per aggiungere o cambiare l'accordo sopra di essa
                    </div>

                    {/* Canvas testo con accordi cliccabili */}
                    <div style={{ overflowY:'auto', maxHeight:260, padding:'12px 10px', background:'#fafafa', borderRadius:10, border:'1.5px solid var(--gray-200)', marginBottom:10 }}>
                      {lineeParole.length === 0 ? (
                        <p className="text-sm text-muted">Nessun testo da mostrare.</p>
                      ) : lineeParole.map((linea, li) => {
                        if (linea.type === 'section') return (
                          <div key={li} style={{ fontWeight:800, color:'var(--primary)', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:14, marginBottom:6 }}>
                            § {linea.text}
                          </div>
                        )
                        if (linea.type === 'empty') return <div key={li} style={{ height:10 }} />
                        return (
                          <div key={li} style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', marginBottom:8 }}>
                            {linea.words.map(w => {
                              if (w.isSpace) return (
                                <span key={w.id} style={{ display:'inline-block', whiteSpace:'pre' }}>
                                  <div style={{ minHeight:26 }} />
                                  <span style={{ fontSize:15 }}>{w.text}</span>
                                </span>
                              )
                              const chord = accordiMap[w.id]
                              const isActive = wordAttiva === w.id
                              return (
                                <span key={w.id} style={{ display:'inline-block', textAlign:'center', cursor:'pointer', userSelect:'none' }}
                                  onClick={() => setWordAttiva(isActive ? null : w.id)}>
                                  <div style={{
                                    minHeight:24, minWidth:28,
                                    padding:'1px 4px', borderRadius:5, marginBottom:1,
                                    fontSize:'0.79rem', fontWeight:900, lineHeight:1.4,
                                    color: chord ? '#1565c0' : (isActive ? 'var(--primary)' : 'var(--gray-300)'),
                                    background: isActive ? 'var(--primary-bg)' : (chord ? '#e8f0fe' : 'transparent'),
                                    border: `1.5px solid ${isActive ? 'var(--primary)' : (chord ? '#1565c0' : 'transparent')}`,
                                    textAlign:'center', transition:'all 0.1s',
                                  }}>
                                    {chord || (isActive ? '···' : '+')}
                                  </div>
                                  <div style={{ fontSize:15, lineHeight:1.5, fontFamily:'Georgia, serif', color:'var(--gray-800)' }}>{w.text}</div>
                                </span>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>

                    {/* Pannello scelta accordo */}
                    {wordAttiva ? (
                      <div style={{ background:'#fff', borderRadius:12, padding:12, border:'1.5px solid #1565c0', boxShadow:'0 4px 16px rgba(21,101,192,0.15)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                          <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--gray-700)' }}>
                            Accordo per: <strong style={{ color:'#1565c0' }}>
                              {lineeParole.flatMap(l => l.words || []).find(w => w.id === wordAttiva)?.text}
                            </strong>
                          </span>
                          <div style={{ display:'flex', gap:5 }}>
                            {accordiMap[wordAttiva] && (
                              <button type="button" onClick={() => { setAccordiMap(m => { const n={...m}; delete n[wordAttiva]; return n }) }}
                                style={{ padding:'3px 8px', borderRadius:6, border:'1.5px solid var(--red)', color:'var(--red)', background:'#fff', fontSize:'0.72rem', cursor:'pointer', fontWeight:700 }}>
                                🗑
                              </button>
                            )}
                            <button type="button" onClick={() => setWordAttiva(null)}
                              style={{ padding:'3px 8px', borderRadius:6, border:'1.5px solid var(--gray-200)', color:'var(--gray-500)', background:'#fff', fontSize:'0.72rem', cursor:'pointer' }}>
                              ✕
                            </button>
                          </div>
                        </div>
                        {/* Tab */}
                        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1.5px solid var(--gray-200)', marginBottom:8 }}>
                          {ACCORDI_GRUPPI.map((g, idx) => (
                            <button key={g.label} type="button" onClick={() => setTabAccordi(idx)}
                              style={{ flex:1, padding:'5px 0', border:'none', cursor:'pointer', fontSize:'0.72rem', fontWeight:800,
                                background: tabAccordi===idx ? g.col : '#fff',
                                color: tabAccordi===idx ? '#fff' : 'var(--gray-600)',
                                borderRight: idx < ACCORDI_GRUPPI.length-1 ? '1px solid var(--gray-200)' : 'none' }}>
                              {g.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          {ACCORDI_GRUPPI[tabAccordi].list.map(a => (
                            <button key={a} type="button"
                              onClick={() => { setAccordiMap(m => ({...m, [wordAttiva]: a})); setWordAttiva(null) }}
                              style={{ padding:'6px 11px', borderRadius:7, cursor:'pointer',
                                border:`1.5px solid ${accordiMap[wordAttiva] === a ? ACCORDI_GRUPPI[tabAccordi].col : 'var(--gray-200)'}`,
                                background: accordiMap[wordAttiva] === a ? ACCORDI_GRUPPI[tabAccordi].col : '#fff',
                                color: accordiMap[wordAttiva] === a ? '#fff' : 'var(--gray-700)',
                                fontWeight:700, fontSize:'0.85rem', minWidth:42, textAlign:'center' }}>
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted" style={{ textAlign:'center', padding:'8px', color:'var(--gray-400)' }}>
                        ↑ tocca una parola per posizionare l'accordo
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tipoIns === 'pdf' && (
              <div className="form-group">
                <label className="form-label">File PDF</label>
                <input ref={pdfInputNuovoRef} type="file" accept="application/pdf" style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f) setPdfFile(f) }}/>
                <div onClick={() => pdfInputNuovoRef.current?.click()}
                  style={{ border:`2px dashed ${pdfFile ? 'var(--primary)' : 'var(--gray-300)'}`, borderRadius:10,
                    padding:'24px 16px', textAlign:'center', cursor:'pointer', background: pdfFile ? 'var(--primary-bg)' : '#fafafa' }}>
                  {pdfFile ? (
                    <>
                      <div style={{ fontSize:'2rem', marginBottom:6 }}>📄</div>
                      <div style={{ fontWeight:800, color:'var(--primary)', fontSize:'0.88rem' }}>{pdfFile.name}</div>
                      <div className="text-xs text-muted" style={{ marginTop:4 }}>{(pdfFile.size/1024/1024).toFixed(1)} MB · Clicca per cambiare</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:'2rem', marginBottom:8 }}>⬆️</div>
                      <div style={{ fontWeight:700, color:'var(--gray-700)', fontSize:'0.9rem' }}>Clicca per selezionare il PDF</div>
                      <div className="text-xs text-muted" style={{ marginTop:4 }}>Max 20 MB</div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>
                {saving ? <><div className="spinner" style={{width:16,height:16,borderTopColor:'#fff'}}/> Salvataggio…</> : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
