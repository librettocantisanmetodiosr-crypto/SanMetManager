import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { logAzione } from '../../lib/logger'

const vuoto = { nome:'', cognome:'', data_nascita:'', indirizzo:'', telefono1:'', telefono2:'', note:'', classe_id:'' }

export default function Bambini() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria','responsabile'].some(r => tuttiRuoli.includes(r))
  const [bambini, setBambini] = useState([])
  const [classi, setClassi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalStats, setModalStats] = useState(null)
  const [statsData, setStatsData] = useState([])
  const [form, setForm] = useState(vuoto)
  const [cerca, setCerca] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { carica() }, [profilo])

  const carica = async () => {
    setLoading(true)
    const { data: cl } = await supabase.from('classi').select('id, nome').eq('attiva', true).order('nome')
    setClassi(cl || [])

    let q = supabase.from('bambini')
      .select('id, nome, cognome, data_nascita, indirizzo, telefono1, telefono2, note, classe_id, classi(nome)')
      .eq('attivo', true).order('cognome')

    if (!isAdmin && tuttiRuoli.includes('catechista')) {
      const { data: cc } = await supabase.from('classi_catechisti').select('classe_id').eq('catechista_id', profilo.id)
      const ids = (cc || []).map(x => x.classe_id)
      if (ids.length > 0) q = q.in('classe_id', ids)
      else { setBambini([]); setLoading(false); return }
    }
    const { data } = await q
    setBambini(data || [])
    setLoading(false)
  }

  const apriStats = async (bambino) => {
    const { data: pres } = await supabase
      .from('presenze')
      .select('stato, date_catechismo(data, descrizione)')
      .eq('bambino_id', bambino.id)
      .order('date_catechismo(data)', { ascending: false })
    setStatsData(pres || [])
    setModalStats(bambino)
  }

  const salva = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) return toast('Nome e cognome obbligatori', 'error')
    setSaving(true)
    const dati = { nome: form.nome, cognome: form.cognome, data_nascita: form.data_nascita || null,
      indirizzo: form.indirizzo, telefono1: form.telefono1, telefono2: form.telefono2,
      note: form.note, classe_id: form.classe_id || null }
    const { error } = modal === 'nuovo'
      ? await supabase.from('bambini').insert(dati)
      : await supabase.from('bambini').update(dati).eq('id', modal.id)
    setSaving(false)
    if (error) return toast(
      error.code === '42501' || error.message?.includes('policy') ? 'Permesso negato (RLS) — esegui il SQL correttivo su Supabase' :
      error.message?.includes('does not exist') ? 'Tabella bambini non trovata — esegui la migrazione SQL' :
      'Errore: ' + error.message, 'error', 8000
    )
    logAzione(modal === 'nuovo' ? 'NUOVO_BAMBINO' : 'MODIFICA_BAMBINO', `${form.cognome} ${form.nome}`)
    toast(modal === 'nuovo' ? 'Bambino aggiunto ✓' : 'Aggiornato ✓', 'success')
    setModal(null)
    carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo bambino?')) return
    const b = bambini.find(x => x.id === id)
    await supabase.from('bambini').update({ attivo: false }).eq('id', id)
    logAzione('ELIMINA_BAMBINO', b ? `${b.cognome} ${b.nome}` : id)
    toast('Eliminato', 'success'); carica()
  }

  const exportExcel = async () => {
    setExporting(true)
    // Carica tutte le presenze per l'export
    const { data: pres } = await supabase.from('presenze')
      .select('bambino_id, stato, date_catechismo(data)')
    const { data: date } = await supabase.from('date_catechismo').select('id, data').order('data')

    const map = {}
    pres?.forEach(p => {
      if (!map[p.bambino_id]) map[p.bambino_id] = {}
      if (p.date_catechismo?.data) map[p.bambino_id][p.date_catechismo.data] = p.stato
    })

    const filtratiExport = bambini.filter(b => !filtroClasse || b.classe_id === filtroClasse)
    let csv = 'Cognome,Nome,Classe'
    date?.forEach(d => { csv += ',' + new Date(d.data).toLocaleDateString('it-IT') })
    csv += ',Totale Presenze,Totale Assenze\n'

    filtratiExport.forEach(b => {
      const pB = map[b.id] || {}
      let presenti = 0, assenti = 0
      let riga = `"${b.cognome}","${b.nome}","${b.classi?.nome || ''}"`
      date?.forEach(d => {
        const s = pB[d.data] || ''
        riga += ',' + s
        if (s === 'P') presenti++
        if (s === 'A') assenti++
      })
      riga += `,${presenti},${assenti}`
      csv += riga + '\n'
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'registro_presenze.csv'; a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
    toast('Export completato ✓', 'success')
  }

  const filtrati = bambini.filter(b => {
    const okN = `${b.nome} ${b.cognome}`.toLowerCase().includes(cerca.toLowerCase())
    const okC = !filtroClasse || b.classe_id === filtroClasse
    return okN && okC
  })

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>👦 Bambini</h1>
        <div style={{ display:'flex', gap:8 }}>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={exportExcel} disabled={exporting}>
              {exporting ? '...' : '⬇ CSV'}
            </button>
          )}
          {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => { setForm(vuoto); setModal('nuovo') }}>＋ Aggiungi</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <input className="form-control" placeholder="🔍 Cerca..." value={cerca} onChange={e => setCerca(e.target.value)} style={{ flex:1 }} />
        <select className="form-control" value={filtroClasse} onChange={e => setFiltroClasse(e.target.value)} style={{ width:130 }}>
          <option value="">Tutte</option>
          {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="text-xs text-muted" style={{ marginBottom:10 }}>{filtrati.length} bambini</div>

      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtrati.map(b => (
            <div key={b.id} className="card">
              <div className="card-body" style={{ padding:'12px 14px' }}>
                <div className="flex items-center justify-between">
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800 }}>{b.cognome} {b.nome}</div>
                    <div className="text-sm text-muted">
                      {b.classi?.nome || 'Nessuna classe'}
                      {b.data_nascita ? ' · n. ' + new Date(b.data_nascita).toLocaleDateString('it-IT') : ''}
                    </div>
                    {b.indirizzo && <div className="text-xs text-muted" style={{ marginTop:2 }}>📍 {b.indirizzo}</div>}
                    {b.note && <div className="text-xs" style={{ color:'var(--red)', marginTop:2 }}>⚠️ {b.note}</div>}
                    {(b.telefono1 || b.telefono2) && (
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        {b.telefono1 && (
                          <a href={`tel:${b.telefono1}`}
                            style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--primary-bg)', color:'var(--primary)', borderRadius:8, padding:'5px 10px', fontSize:'0.82rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}
                            onClick={e => e.stopPropagation()}
                          >📞 {b.telefono1}</a>
                        )}
                        {b.telefono2 && (
                          <a href={`tel:${b.telefono2}`}
                            style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--blue-bg)', color:'var(--blue)', borderRadius:8, padding:'5px 10px', fontSize:'0.82rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}
                            onClick={e => e.stopPropagation()}
                          >📞 {b.telefono2}</a>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => apriStats(b)}>📊</button>
                    {isAdmin && <button className="btn btn-outline btn-sm btn-icon" onClick={() => {
                      setForm({ nome:b.nome, cognome:b.cognome, data_nascita:b.data_nascita||'', indirizzo:b.indirizzo||'', telefono1:b.telefono1||'', telefono2:b.telefono2||'', note:b.note||'', classe_id:b.classe_id||'' })
                      setModal(b)
                    }}>✏️</button>}
                    {isAdmin && <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(b.id)}>🗑</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtrati.length === 0 && <div className="empty-state"><div className="icon">👦</div><p>Nessun bambino trovato</p></div>}
        </div>
      )}

      {/* Modal statistiche bambino */}
      {modalStats && (
        <div className="modal-overlay" onClick={() => setModalStats(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">📊 {modalStats.cognome} {modalStats.nome}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              <div style={{ background:'var(--primary-bg)', borderRadius:10, padding:'12px', textAlign:'center' }}>
                <div style={{ fontWeight:800, fontSize:'1.6rem', color:'var(--primary)' }}>{statsData.filter(p=>p.stato==='P').length}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--primary)', fontWeight:700 }}>PRESENZE</div>
              </div>
              <div style={{ background:'var(--red-bg)', borderRadius:10, padding:'12px', textAlign:'center' }}>
                <div style={{ fontWeight:800, fontSize:'1.6rem', color:'var(--red)' }}>{statsData.filter(p=>p.stato==='A').length}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--red)', fontWeight:700 }}>ASSENZE</div>
              </div>
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--gray-500)', marginBottom:10, fontWeight:700 }}>STORICO INCONTRI</div>
            <div style={{ maxHeight:260, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
              {statsData.length === 0 ? <p className="text-sm text-muted">Nessuna presenza registrata</p> :
                statsData.map((p, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--gray-50)', borderRadius:8 }}>
                    <div className="text-sm">{p.date_catechismo?.data ? new Date(p.date_catechismo.data).toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'short' }) : '—'}</div>
                    <span className={`badge ${p.stato==='P' ? 'badge-green' : 'badge-red'}`}>{p.stato==='P' ? 'Presente' : 'Assente'}</span>
                  </div>
                ))
              }
            </div>
            <button className="btn btn-outline btn-block" style={{ marginTop:16 }} onClick={() => setModalStats(null)}>Chiudi</button>
          </div>
        </div>
      )}

      {/* Modal aggiungi/modifica */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Bambino' : 'Modifica'}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Cognome *</label><input className="form-control" value={form.cognome} onChange={e => setForm(f=>({...f,cognome:e.target.value}))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Data di nascita</label><input type="date" className="form-control" value={form.data_nascita} onChange={e => setForm(f=>({...f,data_nascita:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Classe</label>
                <select className="form-control" value={form.classe_id} onChange={e => setForm(f=>({...f,classe_id:e.target.value}))}>
                  <option value="">— nessuna —</option>
                  {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Indirizzo</label><input className="form-control" value={form.indirizzo} onChange={e => setForm(f=>({...f,indirizzo:e.target.value}))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Telefono 1</label><input type="tel" className="form-control" value={form.telefono1} onChange={e => setForm(f=>({...f,telefono1:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Telefono 2</label><input type="tel" className="form-control" value={form.telefono2} onChange={e => setForm(f=>({...f,telefono2:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Note (allergie, patologie…)</label><textarea className="form-control" rows={2} value={form.note} onChange={e => setForm(f=>({...f,note:e.target.value}))} /></div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}