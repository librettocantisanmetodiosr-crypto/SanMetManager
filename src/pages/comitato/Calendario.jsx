import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const GIORNI_SETT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']

const fmtData = (dataStr) => {
  // Append time to avoid UTC midnight → wrong local day
  const d = new Date(dataStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Calendario() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const canEdit = ['admin','parroco','responsabile_comitato','responsabile'].some(r => tuttiRuoli.includes(r))
  const [eventi, setEventi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ titolo:'', data:'', ora_inizio:'', ora_fine:'', luogo:'', note:'' })
  const [saving, setSaving] = useState(false)
  const [giornoSelezionato, setGiornoSelezionato] = useState(null)
  const now = new window.Date()
  const [anno, setAnno] = useState(now.getFullYear())
  const [mese, setMese] = useState(now.getMonth())

  useEffect(() => { carica() }, [anno, mese])

  const carica = async () => {
    setLoading(true)
    const inizioMese = `${anno}-${String(mese+1).padStart(2,'0')}-01`
    const fineMese = `${anno}-${String(mese+1).padStart(2,'0')}-${new window.Date(anno, mese+1, 0).getDate()}`
    const { data } = await supabase.from('eventi_calendario')
      .select('*').gte('data', inizioMese).lte('data', fineMese).order('data').order('ora_inizio')
    setEventi(data || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.titolo || !form.data) return toast('Titolo e data obbligatori', 'error')
    setSaving(true)
    const { error } = modal === 'nuovo'
      ? await supabase.from('eventi_calendario').insert({ ...form, autore_id: profilo?.id })
      : await supabase.from('eventi_calendario').update(form).eq('id', modal.id)
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast('Evento salvato ✓', 'success'); setModal(null); carica() }
    setSaving(false)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo evento?')) return
    await supabase.from('eventi_calendario').delete().eq('id', id)
    toast('Evento eliminato', 'success')
    carica()
  }

  const apriNuovo = (dataPrecompilata) => {
    setForm({ titolo:'', data: dataPrecompilata || `${anno}-${String(mese+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, ora_inizio:'', ora_fine:'', luogo:'', note:'' })
    setModal('nuovo')
  }

  // Griglia calendario
  const primoGiorno = new window.Date(anno, mese, 1)
  const giorniNelMese = new window.Date(anno, mese + 1, 0).getDate()
  const offset = (primoGiorno.getDay() + 6) % 7 // 0=lun
  const oggi = new window.Date().toISOString().split('T')[0]

  const giorniConEventi = {}
  eventi.forEach(e => {
    if (!giorniConEventi[e.data]) giorniConEventi[e.data] = []
    giorniConEventi[e.data].push(e)
  })

  const mesePrecedente = () => { if (mese === 0) { setMese(11); setAnno(a=>a-1) } else setMese(m=>m-1) }
  const meseSeguente  = () => { if (mese === 11) { setMese(0); setAnno(a=>a+1) } else setMese(m=>m+1) }

  const eventiVisibili = giornoSelezionato
    ? (giorniConEventi[giornoSelezionato] || [])
    : eventi

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🗓️ Calendario</h1>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => apriNuovo()}>＋ Evento</button>
        )}
      </div>

      {/* Navigazione mese */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:'12px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button className="btn btn-outline btn-sm btn-icon" onClick={mesePrecedente}>‹</button>
            <div style={{ fontWeight:800, fontSize:'1rem' }}>{MESI[mese]} {anno}</div>
            <button className="btn btn-outline btn-sm btn-icon" onClick={meseSeguente}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {GIORNI_SETT.map(g => (
              <div key={g} style={{ textAlign:'center', fontSize:'0.65rem', fontWeight:700, color:'var(--gray-500)', padding:'4px 0', textTransform:'uppercase' }}>{g}</div>
            ))}
            {Array.from({ length: offset }).map((_, i) => <div key={'e'+i} />)}
            {Array.from({ length: giorniNelMese }).map((_, i) => {
              const giorno = i + 1
              const dataStr = `${anno}-${String(mese+1).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`
              const hasEvt = !!giorniConEventi[dataStr]
              const isOggi = dataStr === oggi
              const isSelected = dataStr === giornoSelezionato
              return (
                <div key={giorno}
                  onClick={() => {
                    if (hasEvt) setGiornoSelezionato(prev => prev === dataStr ? null : dataStr)
                    else if (canEdit) apriNuovo(dataStr)
                  }}
                  style={{
                    textAlign:'center', padding:'6px 2px', borderRadius:8, fontSize:'0.82rem',
                    fontWeight: isOggi ? 800 : 400,
                    background: isSelected ? 'var(--red)' : isOggi ? 'var(--primary)' : 'transparent',
                    color: isSelected || isOggi ? '#fff' : 'var(--gray-900)',
                    cursor: hasEvt || canEdit ? 'pointer' : 'default',
                    position:'relative',
                    outline: isSelected ? '2px solid var(--red)' : 'none',
                  }}>
                  {giorno}
                  {hasEvt && (
                    <div style={{ width:5, height:5, borderRadius:'50%', background: isSelected || isOggi ? '#fff' : 'var(--red)', margin:'2px auto 0' }} />
                  )}
                </div>
              )
            })}
          </div>
          {giornoSelezionato && (
            <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div className="text-sm" style={{ color:'var(--red)', fontWeight:700 }}>
                📅 {fmtData(giornoSelezionato)} — {(giorniConEventi[giornoSelezionato]||[]).length} evento/i
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setGiornoSelezionato(null)}>✕ Mostra tutti</button>
            </div>
          )}
        </div>
      </div>

      {/* Lista eventi */}
      <h3 style={{ marginBottom:10, fontSize:'0.85rem', color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {loading ? 'Caricamento...' : giornoSelezionato
          ? `${eventiVisibili.length} eventi in questo giorno`
          : `${eventi.length} eventi questo mese`
        }
      </h3>
      {eventiVisibili.length === 0 && !loading ? (
        <div className="empty-state"><div className="icon">📅</div><p>Nessun evento{giornoSelezionato ? ' in questo giorno' : ' questo mese'}</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {eventiVisibili.map(e => (
            <div key={e.id} className="card" style={{ borderLeft:'4px solid var(--blue)' }}>
              <div className="card-body" style={{ padding:'12px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom:4 }}>
                  <div style={{ fontWeight:800 }}>{e.titolo}</div>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-outline btn-sm btn-icon" onClick={() => { setForm({ titolo:e.titolo, data:e.data, ora_inizio:e.ora_inizio||'', ora_fine:e.ora_fine||'', luogo:e.luogo||'', note:e.note||'' }); setModal(e) }}>✏️</button>
                      <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(e.id)}>🗑</button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted">
                  📅 {fmtData(e.data)}
                  {e.ora_inizio ? ` · ${e.ora_inizio.slice(0,5)}` : ''}
                  {e.ora_fine ? `–${e.ora_fine.slice(0,5)}` : ''}
                </div>
                {e.luogo && <div className="text-sm text-muted">📍 {e.luogo}</div>}
                {e.note && <div className="text-sm text-muted" style={{ marginTop:4 }}>{e.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && canEdit && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Evento' : 'Modifica Evento'}</div>
            <div className="form-group"><label className="form-label">Titolo *</label><input className="form-control" value={form.titolo} onChange={e => setForm(f=>({...f,titolo:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Data *</label><input type="date" className="form-control" value={form.data} onChange={e => setForm(f=>({...f,data:e.target.value}))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Orario inizio</label><input type="time" className="form-control" value={form.ora_inizio} onChange={e => setForm(f=>({...f,ora_inizio:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Orario fine</label><input type="time" className="form-control" value={form.ora_fine} onChange={e => setForm(f=>({...f,ora_fine:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Luogo</label><input className="form-control" value={form.luogo} onChange={e => setForm(f=>({...f,luogo:e.target.value}))} placeholder="Es: Chiesa, Salone..." /></div>
            <div className="form-group"><label className="form-label">Note</label><textarea className="form-control" rows={2} value={form.note} onChange={e => setForm(f=>({...f,note:e.target.value}))} /></div>
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
