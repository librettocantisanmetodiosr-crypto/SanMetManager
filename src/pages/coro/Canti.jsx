import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

// ── Costanti liturgiche ──────────────────────────────────────────
const MOMENTI = [
  'Ingresso','Kyrie','Gloria','Salmo','Alleluia',
  'Offertorio','Santo','Agnello di Dio','Comunione',
  'Ringraziamento','Uscita','Adorazione','Mariano','Altro',
]
const TEMPI = ['Avvento','Natale','Quaresima','Pasqua','Tempo Ordinario','Feste Mariane','Feste dei Santi']
const ACCORDI = ['Do','Re','Mi','Fa','Sol','La','Si','Dom','Rem','Mim','Fam','Solm','Lam','Sim','Do7','Sol7','La7']
const SEZIONI  = ['Ritornello','Strofa 1','Strofa 2','Strofa 3','Bridge','Intro','Coda','Fine']

const MOMENTO_COLOR = {
  'Ingresso':'#1565c0','Kyrie':'#0891b2','Gloria':'#d97706',
  'Salmo':'#059669','Alleluia':'#16a34a','Offertorio':'#f59e0b',
  'Santo':'#2563eb','Agnello di Dio':'#7c3aed','Comunione':'#1a6b3c',
  'Ringraziamento':'#0d6b3c','Uscita':'#c62828','Adorazione':'#7c3aed',
  'Mariano':'#db2777','Altro':'#6b7280',
}

const vuotoForm = { titolo:'', categoria:'', tonalita:'', tempo_liturgico:'', testo:'' }

// ── Render testo con accordi e sezioni ──────────────────────────
function TestoFormattato({ testo, fontSize = 14 }) {
  if (!testo) return null
  return (
    <div style={{ fontFamily:'monospace', fontSize, lineHeight:1.9 }}>
      {testo.split('\n').map((riga, i) => {
        if (riga.startsWith('## ')) {
          return (
            <div key={i} style={{
              fontFamily:'Nunito, sans-serif', fontWeight:800, color:'var(--primary)',
              marginTop:16, marginBottom:4, fontSize:fontSize*0.78,
              textTransform:'uppercase', letterSpacing:'0.1em',
              borderBottom:'1.5px solid var(--primary-bg)', paddingBottom:3,
            }}>
              {riga.slice(3)}
            </div>
          )
        }
        if (!riga.trim()) return <div key={i} style={{ height:6 }} />
        return (
          <div key={i}>
            {riga.split(/(\[[^\]]+\])/g).map((p, j) =>
              p.startsWith('[') ? (
                <span key={j} style={{ color:'var(--blue)', fontWeight:800, fontSize:fontSize*0.82 }}>
                  {p.slice(1,-1)}{' '}
                </span>
              ) : <span key={j}>{p}</span>
            )}
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

  // Modali
  const [vistaModal, setVistaModal] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuovo' | canto-object
  const [vistaPdf, setVistaPdf] = useState(false) // in vistaModal: mostra PDF o testo

  // Form
  const [tipoIns, setTipoIns] = useState('testo') // 'testo' | 'pdf'
  const [form, setForm] = useState(vuotoForm)
  const [pdfFile, setPdfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [fontSize, setFontSize] = useState(14)

  // Upload PDF su canto esistente
  const [uploadingPdf, setUploadingPdf] = useState(null)
  const pdfInputRef = useRef(null)
  const pdfInputNuovoRef = useRef(null)
  const pdfTargetRef = useRef(null)
  const textareaRef = useRef(null)

  // Filtri
  const [cerca, setCerca] = useState('')
  const [filtroMomento, setFiltroMomento] = useState('')
  const [filtroTempo, setFiltroTempo] = useState('')

  // Refs per evitare stale closure nei callback asincroni
  const cantiRef      = useRef([])
  const isRespRef     = useRef(false)
  const cantoAttivoRef = useRef(null)
  useEffect(() => { cantiRef.current      = canti       }, [canti])
  useEffect(() => { isRespRef.current     = isResp      }, [isResp])
  useEffect(() => { cantoAttivoRef.current = cantoAttivo }, [cantoAttivo])

  useEffect(() => {
    caricaCanti()
    caricaCantoAttivo()
  }, [])

  // Polling ogni 3s — garantisce aggiornamento su tutti i dispositivi
  // indipendentemente dalla configurazione del realtime Supabase
  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase.from('canto_attivo').select('canto_id').eq('id', 1).single()
      const nuovoId = data?.canto_id ?? null
      if (nuovoId === cantoAttivoRef.current) return  // nessun cambiamento
      setCantoAttivo(nuovoId)
      if (!isRespRef.current) {
        if (nuovoId) {
          const c = cantiRef.current.find(x => x.id === nuovoId)
          if (c) { setVistaModal(c); setVistaPdf(!!c.pdf_url && !c.testo) }
        } else {
          setVistaModal(null)
        }
      }
    }
    const timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [])

  // Escape chiude modali
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
    const { data } = await supabase.from('canto_attivo').select('canto_id').eq('id', 1).single()
    setCantoAttivo(data?.canto_id ?? null)
  }

  const lancia = async (cantoId) => {
    const stop = cantoAttivo === cantoId
    const nuovoId = stop ? null : cantoId
    await supabase.from('canto_attivo').update({
      canto_id: nuovoId,
      lanciato_da: profilo?.id,
      lanciato_at: new Date().toISOString(),
    }).eq('id', 1)
    setCantoAttivo(nuovoId)
    if (stop) toast('Canto fermato', 'default')
    else toast(`🎵 ${canti.find(c => c.id === cantoId)?.titolo}`, 'success')
  }

  const apriNuovo = () => {
    setForm(vuotoForm); setTipoIns('testo'); setPdfFile(null); setShowPreview(false); setModal('nuovo')
  }
  const apriModifica = (c) => {
    setForm({ titolo:c.titolo||'', categoria:c.categoria||'', tonalita:c.tonalita||'',
      tempo_liturgico:c.tempo_liturgico||'', testo:c.testo||'' })
    setTipoIns(c.testo ? 'testo' : 'pdf')
    setPdfFile(null); setShowPreview(false); setModal(c)
  }

  const salva = async () => {
    if (!form.titolo.trim()) return toast('Inserisci il titolo','error')
    if (tipoIns === 'pdf' && modal === 'nuovo' && !pdfFile) return toast('Seleziona un file PDF','error')
    setSaving(true)
    const dati = {
      titolo: form.titolo.trim(),
      categoria: form.categoria || null,
      tonalita: form.tonalita || null,
      tempo_liturgico: form.tempo_liturgico || null,
      testo: tipoIns === 'testo' ? (form.testo || null) : null,
      autore_id: profilo?.id,
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

  const avviaUploadPdf = (cantoId) => { pdfTargetRef.current = cantoId; pdfInputRef.current?.click() }
  const onPdfEsistente = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const cantoId = pdfTargetRef.current
    if (!cantoId || file.type !== 'application/pdf') return toast('Seleziona un PDF','error')
    if (file.size > 20*1024*1024) return toast('File troppo grande (max 20 MB)','error')
    setUploadingPdf(cantoId)
    await uploadPdfFile(file, cantoId)
    setUploadingPdf(null); e.target.value = ''; caricaCanti()
    toast('PDF caricato ✓','success')
  }
  const rimuoviPdf = async (cantoId) => {
    if (!window.confirm('Rimuovere il PDF?')) return
    await supabase.storage.from('canti-pdf').remove([`${cantoId}.pdf`])
    await supabase.from('canti').update({ pdf_url: null }).eq('id', cantoId)
    toast('PDF rimosso','success'); caricaCanti()
  }

  // Inserisce testo al cursore nel textarea
  const inserisci = (txt) => {
    const el = textareaRef.current
    if (!el) { setForm(f => ({ ...f, testo: f.testo + txt })); return }
    const s = el.selectionStart, e2 = el.selectionEnd
    const nuovo = form.testo.slice(0, s) + txt + form.testo.slice(e2)
    setForm(f => ({ ...f, testo: nuovo }))
    setTimeout(() => { el.focus(); el.setSelectionRange(s+txt.length, s+txt.length) }, 0)
  }
  const inserisciSezione = (nome) => inserisci(`\n## ${nome}\n`)
  const inserisciAccordo = (a) => inserisci(`[${a}]`)

  // Filtri
  const hasFilter = cerca || filtroMomento || filtroTempo

  const cantiFiltrati = canti.filter(c => {
    if (cerca && !`${c.titolo} ${c.categoria||''}`.toLowerCase().includes(cerca.toLowerCase())) return false
    if (filtroMomento && c.categoria !== filtroMomento) return false
    if (filtroTempo && c.tempo_liturgico !== filtroTempo) return false
    return true
  }).sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'))

  // Raggruppa per momento se non c'è filtro momento attivo
  const cantiRaggruppati = (() => {
    if (filtroMomento || cerca) return null // flat list
    const gruppi = {}
    cantiFiltrati.forEach(c => {
      const m = c.categoria || 'Altro'
      if (!gruppi[m]) gruppi[m] = []
      gruppi[m].push(c)
    })
    // Ordina gruppi per ordine MOMENTI
    return MOMENTI.filter(m => gruppi[m]).map(m => ({ momento: m, canti: gruppi[m] }))
      .concat(Object.keys(gruppi).filter(m => !MOMENTI.includes(m)).map(m => ({ momento: m, canti: gruppi[m] })))
  })()

  const renderCanto = (c) => {
    const col = MOMENTO_COLOR[c.categoria] || 'var(--gray-300)'
    const attivo = cantoAttivo === c.id
    return (
      <div key={c.id} className="card" style={{ borderLeft: `3px solid ${attivo ? 'var(--primary)' : col}`, background: attivo ? '#f0faf4' : '#fff' }}>
        <div className="card-body" style={{ padding:'11px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, cursor:'pointer', minWidth:0 }} onClick={() => { setVistaModal(c); setVistaPdf(!!c.pdf_url && !c.testo) }}>
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
                  <button className="btn btn-outline btn-sm btn-icon" title="Apri PDF">📄</button>
                </a>
              )}
              {isResp && (
                <>
                  <button className="btn btn-outline btn-sm btn-icon" title={c.pdf_url ? 'Sostituisci PDF' : 'Carica PDF'}
                    disabled={uploadingPdf === c.id} onClick={() => avviaUploadPdf(c.id)}>
                    {uploadingPdf === c.id ? <div className="spinner" style={{width:14,height:14}}/> : '⬆'}
                  </button>
                  {c.pdf_url && (
                    <button className="btn btn-outline btn-sm btn-icon" title="Rimuovi PDF" onClick={() => rimuoviPdf(c.id)}>✕</button>
                  )}
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

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      {/* Input PDF nascosti */}
      <input ref={pdfInputRef} type="file" accept="application/pdf" style={{display:'none'}} onChange={onPdfEsistente}/>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1>🎵 Canti</h1>
        {isResp && <button className="btn btn-primary btn-sm" onClick={apriNuovo}>＋ Aggiungi</button>}
      </div>

      {/* Banner canto attivo */}
      {cantoAttivo && (
        <div style={{ background:'var(--primary)', color:'#fff', padding:'12px 16px', borderRadius:12, marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.3rem' }}>🎵</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:'0.9rem' }}>In corso: {canti.find(c=>c.id===cantoAttivo)?.titolo}</div>
            <div style={{ fontSize:'0.72rem', opacity:0.8 }}>Tap per aprire il testo</div>
          </div>
          <button className="btn btn-sm" style={{ background:'rgba(255,255,255,0.2)', color:'#fff' }}
            onClick={() => { const c=canti.find(x=>x.id===cantoAttivo); if(c){setVistaModal(c);setVistaPdf(!!c.pdf_url&&!c.testo)} }}>
            Apri
          </button>
        </div>
      )}

      {/* ── Filtri ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="card-body" style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          {/* Ricerca */}
          <input className="form-control" placeholder="🔍 Cerca canto…" value={cerca}
            onChange={e => setCerca(e.target.value)} />

          {/* Momenti liturgici — scroll orizzontale */}
          <div style={{ overflowX:'auto', paddingBottom:2 }}>
            <div style={{ display:'flex', gap:6, whiteSpace:'nowrap' }}>
              <button onClick={() => setFiltroMomento('')}
                className={filtroMomento==='' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>
                Tutti
              </button>
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

          {/* Tempo liturgico */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select className="form-control" style={{ fontSize:'0.78rem', padding:'6px 28px 6px 10px', flex:1 }}
              value={filtroTempo} onChange={e => setFiltroTempo(e.target.value)}>
              <option value="">Tutti i tempi liturgici</option>
              {TEMPI.map(t => <option key={t}>{t}</option>)}
            </select>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setCerca(''); setFiltroMomento(''); setFiltroTempo('') }}>
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted" style={{ marginBottom:10, fontWeight:700 }}>
        {cantiFiltrati.length} canti
      </div>

      {/* ── Lista ──────────────────────────────────────────── */}
      {loading ? (
        <div className="loader"><div className="spinner"/>Caricamento…</div>
      ) : cantiFiltrati.length === 0 ? (
        <div className="empty-state"><div className="icon">🎶</div><p>Nessun canto trovato</p></div>
      ) : cantiRaggruppati ? (
        // Raggruppati per momento
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {cantiRaggruppati.map(({ momento, canti: lista }) => (
            <div key={momento}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, paddingBottom:6, borderBottom:`2px solid ${MOMENTO_COLOR[momento]||'var(--gray-200)'}` }}>
                <span style={{ fontWeight:800, color: MOMENTO_COLOR[momento]||'var(--gray-500)', fontSize:'0.9rem' }}>{momento}</span>
                <span className="badge badge-gray">{lista.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {lista.map(renderCanto)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Lista piatta (ricerca o filtro momento attivo)
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {cantiFiltrati.map(renderCanto)}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: VISTA CANTO
      ══════════════════════════════════════════════════ */}
      {vistaModal && (
        <div className="modal-overlay" onClick={() => setVistaModal(null)}>
          <div className="modal" style={{ maxHeight:'92vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>

            {/* Intestazione */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ flex:1, marginRight:8 }}>
                <h2 style={{ fontSize:'1.05rem', lineHeight:1.3 }}>{vistaModal.titolo}</h2>
                <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                  {vistaModal.categoria && <span className="badge badge-green">{vistaModal.categoria}</span>}
                  {vistaModal.tonalita && <span className="badge badge-blue">{vistaModal.tonalita}</span>}
                  {vistaModal.tempo_liturgico && <span className="badge badge-gold">{vistaModal.tempo_liturgico}</span>}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setVistaModal(null)}>✕</button>
            </div>

            {/* Tab PDF / Testo se entrambi disponibili */}
            {vistaModal.testo && vistaModal.pdf_url && (
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                <button onClick={() => setVistaPdf(false)}
                  className={!vistaPdf ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>✍️ Testo</button>
                <button onClick={() => setVistaPdf(true)}
                  className={vistaPdf ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}>📄 PDF</button>
              </div>
            )}

            {/* Controllo font (solo testo) */}
            {vistaModal.testo && !vistaPdf && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span className="text-xs text-muted">Testo:</span>
                <input type="range" min={11} max={22} value={fontSize} onChange={e=>setFontSize(+e.target.value)}
                  style={{ flex:1, accentColor:'var(--primary)' }}/>
                <span className="text-xs text-muted">{fontSize}px</span>
                {isResp && (
                  <button className="btn btn-sm" onClick={() => lancia(vistaModal.id)}
                    style={{ background: cantoAttivo===vistaModal.id ? 'var(--red)' : 'var(--primary)', color:'#fff', fontWeight:800 }}>
                    {cantoAttivo===vistaModal.id ? '⏹ Stop' : '▶ Lancia'}
                  </button>
                )}
              </div>
            )}

            {/* Contenuto */}
            {!vistaPdf && vistaModal.testo ? (
              <div style={{ overflowY:'auto', maxHeight:'65vh' }}>
                <TestoFormattato testo={vistaModal.testo} fontSize={fontSize}/>
              </div>
            ) : vistaModal.pdf_url ? (
              <div>
                <iframe
                  src={vistaModal.pdf_url + '#toolbar=0&navpanes=0&scrollbar=0'}
                  style={{ width:'100%', height:'62vh', border:'none', borderRadius:8, background:'#f5f5f5' }}
                  title={vistaModal.titolo}
                />
                <a href={vistaModal.pdf_url} target="_blank" rel="noreferrer"
                  style={{ display:'block', marginTop:8, textAlign:'center' }}>
                  <button className="btn btn-outline btn-sm btn-block">↗ Apri in nuova scheda</button>
                </a>
              </div>
            ) : (
              <p className="text-muted text-sm">Nessun testo o PDF disponibile.</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: AGGIUNGI / MODIFICA
      ══════════════════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxHeight:'95vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Canto' : 'Modifica Canto'}</div>

            {/* Tipo inserimento (solo per nuovo) */}
            {modal === 'nuovo' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {[
                  { val:'testo', icon:'✍️', label:'Scrivi testo', sub:'Inserisci parole e accordi' },
                  { val:'pdf',   icon:'📄', label:'Carica PDF',   sub:'Scansione o file esistente' },
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

            {/* Titolo */}
            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-control" value={form.titolo}
                onChange={e => setForm(f=>({...f,titolo:e.target.value}))} placeholder="Es: Messa di Lourdes"/>
            </div>

            {/* Momento + Tonalità */}
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

            {/* Tempo liturgico */}
            <div className="form-group">
              <label className="form-label">Tempo liturgico</label>
              <select className="form-control" value={form.tempo_liturgico} onChange={e => setForm(f=>({...f,tempo_liturgico:e.target.value}))}>
                <option value="">Tutto l'anno</option>
                {TEMPI.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* ── Tipo TESTO: editor con toolbar ── */}
            {tipoIns === 'testo' && (
              <div className="form-group">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <label className="form-label" style={{ margin:0 }}>Testo e accordi</label>
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setShowPreview(v=>!v)}>
                    {showPreview ? '✏️ Editor' : '👁 Preview'}
                  </button>
                </div>

                {!showPreview ? (
                  <>
                    {/* Toolbar sezioni */}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                      {SEZIONI.map(s => (
                        <button key={s} type="button" className="btn btn-outline btn-sm"
                          style={{ fontSize:'0.7rem', padding:'3px 8px', color:'var(--primary)', borderColor:'var(--primary)' }}
                          onClick={() => inserisciSezione(s)}>
                          § {s}
                        </button>
                      ))}
                    </div>
                    {/* Toolbar accordi */}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                      {ACCORDI.map(a => (
                        <button key={a} type="button" className="btn btn-outline btn-sm"
                          style={{ fontSize:'0.7rem', padding:'3px 8px', color:'var(--blue)', borderColor:'var(--blue)' }}
                          onClick={() => inserisciAccordo(a)}>
                          {a}
                        </button>
                      ))}
                    </div>
                    {/* Legenda */}
                    <div className="text-xs text-muted" style={{ marginBottom:6 }}>
                      <strong>[Do]</strong> = accordo (in blu) &nbsp;·&nbsp; <strong>## Ritornello</strong> = intestazione sezione
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="form-control"
                      rows={10}
                      value={form.testo}
                      onChange={e => setForm(f=>({...f,testo:e.target.value}))}
                      placeholder={'## Ritornello\n[Sol]Tu sei la mia vi[Re]ta...\n\n## Strofa 1\n[Do]Nel cammino...'}
                      style={{ fontFamily:'monospace', fontSize:13, lineHeight:1.7 }}
                    />
                  </>
                ) : (
                  <div style={{ border:'1.5px solid var(--gray-200)', borderRadius:8, padding:'12px 16px', minHeight:200, background:'#fafafa' }}>
                    {form.testo ? <TestoFormattato testo={form.testo} fontSize={14}/> : <p className="text-muted text-sm">Nessun testo ancora…</p>}
                  </div>
                )}
              </div>
            )}

            {/* ── Tipo PDF: upload ── */}
            {tipoIns === 'pdf' && (
              <div className="form-group">
                <label className="form-label">File PDF</label>
                <input
                  ref={pdfInputNuovoRef}
                  type="file" accept="application/pdf"
                  style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f) setPdfFile(f) }}
                />
                <div
                  onClick={() => pdfInputNuovoRef.current?.click()}
                  style={{
                    border:`2px dashed ${pdfFile ? 'var(--primary)' : 'var(--gray-300)'}`,
                    borderRadius:10, padding:'24px 16px', textAlign:'center', cursor:'pointer',
                    background: pdfFile ? 'var(--primary-bg)' : '#fafafa',
                    transition:'all 0.15s',
                  }}
                >
                  {pdfFile ? (
                    <>
                      <div style={{ fontSize:'2rem', marginBottom:6 }}>📄</div>
                      <div style={{ fontWeight:800, color:'var(--primary)', fontSize:'0.88rem' }}>{pdfFile.name}</div>
                      <div className="text-xs text-muted" style={{ marginTop:4 }}>
                        {(pdfFile.size/1024/1024).toFixed(1)} MB · Clicca per cambiare
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:'2rem', marginBottom:8 }}>⬆️</div>
                      <div style={{ fontWeight:700, color:'var(--gray-700)', fontSize:'0.9rem' }}>Clicca per selezionare il PDF</div>
                      <div className="text-xs text-muted" style={{ marginTop:4 }}>Max 20 MB</div>
                    </>
                  )}
                </div>
                {modal !== 'nuovo' && (
                  <div className="text-xs text-muted" style={{ marginTop:6 }}>
                    Seleziona un nuovo PDF solo per sostituire quello esistente.
                  </div>
                )}
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
