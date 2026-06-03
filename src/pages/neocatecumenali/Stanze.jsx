import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Stanze() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [stanze, setStanze] = useState([])
  const [comunita, setComunita] = useState([])
  const [prenotazioni, setPrenotazioni] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ stanza_id:'', comunita_id:'', data:'', ora_inizio:'', ora_fine:'', note:'' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const [{ data: st }, { data: co }, { data: pr }] = await Promise.all([
      supabase.from('stanze').select('*').order('nome'),
      supabase.from('comunita_neo').select('id, nome').order('nome'),
      supabase.from('prenotazioni_stanze').select('*, stanze(nome), comunita_neo(nome)').order('data').order('ora_inizio').limit(30)
    ])
    setStanze(st || [])
    setComunita(co || [])
    setPrenotazioni(pr || [])
    setLoading(false)
  }

  const oggi = new Date().toISOString().split('T')[0]
  const prenotazioniOggi = prenotazioni.filter(p => p.data === oggi)

  const isOccupata = (stanzaId) => prenotazioniOggi.some(p => p.stanza_id === stanzaId)

  const salva = async () => {
    if (!form.stanza_id || !form.data) return toast('Stanza e data obbligatorie', 'error')
    setSaving(true)
    await supabase.from('prenotazioni_stanze').insert({ ...form, autore_id: profilo?.id })
    toast('Prenotazione salvata', 'success')
    setSaving(false); setModal(false); setForm({ stanza_id:'', comunita_id:'', data:'', ora_inizio:'', ora_fine:'', note:'' }); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa prenotazione?')) return
    await supabase.from('prenotazioni_stanze').delete().eq('id', id)
    toast('Prenotazione eliminata', 'success'); carica()
  }

  const iconaStanza = (nome) => {
    if (nome?.toLowerCase().includes('chiesa')) return '⛪'
    if (nome?.toLowerCase().includes('salone')) return '🏛️'
    return '🚪'
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🚪 Stanze</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>＋ Prenota</button>
      </div>
      {/* Stato stanze oggi */}
      <h3 style={{ marginBottom:10, fontSize:'0.85rem', color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Stato oggi</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {stanze.map(s => (
          <div key={s.id} className="card" style={{ textAlign:'center', padding:16 }}>
            <div style={{ fontSize:'1.8rem', marginBottom:6 }}>{iconaStanza(s.nome)}</div>
            <div style={{ fontWeight:700, fontSize:'0.82rem', marginBottom:6 }}>{s.nome}</div>
            {isOccupata(s.id)
              ? <span className="badge badge-red">Occupata</span>
              : <span className="badge badge-green">Libera</span>}
          </div>
        ))}
      </div>
      {/* Prenotazioni */}
      <div className="flex items-center justify-between mb-3">
        <h3>Prossime prenotazioni</h3>
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : prenotazioni.length === 0 ? (
        <div className="empty-state"><div className="icon">🚪</div><p>Nessuna prenotazione</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {prenotazioni.map(p => (
            <div key={p.id} className="card">
              <div className="card-body" style={{ padding:'11px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{iconaStanza(p.stanze?.nome)} {p.stanze?.nome}</div>
                  <div className="text-sm text-muted">
                    {new Date(p.data).toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'short' })}
                    {p.ora_inizio ? ` · ${p.ora_inizio.slice(0,5)}` : ''}
                    {p.ora_fine ? `–${p.ora_fine.slice(0,5)}` : ''}
                  </div>
                  {p.comunita_neo && <div className="text-sm" style={{ color:'var(--red)' }}>🕊️ {p.comunita_neo.nome}</div>}
                </div>
                <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(p.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Nuova Prenotazione</div>
            <div className="form-group"><label className="form-label">Stanza *</label>
              <select className="form-control" value={form.stanza_id} onChange={e => setForm(f=>({...f,stanza_id:e.target.value}))}>
                <option value="">— seleziona —</option>
                {stanze.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Comunità</label>
              <select className="form-control" value={form.comunita_id} onChange={e => setForm(f=>({...f,comunita_id:e.target.value}))}>
                <option value="">— nessuna —</option>
                {comunita.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Data *</label><input type="date" className="form-control" value={form.data} onChange={e => setForm(f=>({...f,data:e.target.value}))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Dalle</label><input type="time" className="form-control" value={form.ora_inizio} onChange={e => setForm(f=>({...f,ora_inizio:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Alle</label><input type="time" className="form-control" value={form.ora_fine} onChange={e => setForm(f=>({...f,ora_fine:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Note</label><input className="form-control" value={form.note} onChange={e => setForm(f=>({...f,note:e.target.value}))} /></div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Prenota'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}