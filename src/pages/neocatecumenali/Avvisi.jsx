import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Avvisi() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isResp = ['admin','parroco','responsabile_neo'].includes(profilo?.ruolo)
  const [avvisi, setAvvisi] = useState([])
  const [comunita, setComunita] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titolo:'', testo:'', comunita_id:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const [{ data: av }, { data: co }] = await Promise.all([
      supabase.from('avvisi_neo').select('*, comunita_neo(nome), profili(nome,cognome)').order('created_at', { ascending:false }),
      supabase.from('comunita_neo').select('id, nome').order('nome')
    ])
    setAvvisi(av || [])
    setComunita(co || [])
    setLoading(false)
  }

  const pubblica = async () => {
    if (!form.titolo || !form.testo) return toast('Titolo e testo obbligatori', 'error')
    setSaving(true)
    const { error } = await supabase.from('avvisi_neo').insert({
      ...form, comunita_id: form.comunita_id || null, autore_id: profilo?.id
    })
    if (error) toast('Errore nella pubblicazione', 'error')
    else { toast('Avviso pubblicato ✓', 'success'); setModal(false); setForm({ titolo:'', testo:'', comunita_id:'' }); carica() }
    setSaving(false)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo avviso?')) return
    await supabase.from('avvisi_neo').delete().eq('id', id)
    toast('Eliminato', 'success'); carica()
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>📢 Avvisi</h1>
        {isResp && <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>＋ Avviso</button>}
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : avvisi.length === 0 ? (
        <div className="empty-state"><div className="icon">📢</div><p>Nessun avviso</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {avvisi.map(a => (
            <div key={a.id} className="card" style={{ borderLeft:'4px solid var(--red)' }}>
              <div className="card-body">
                <div className="flex items-center justify-between" style={{ marginBottom:6 }}>
                  <div style={{ fontWeight:800, fontSize:'0.95rem' }}>{a.titolo}</div>
                  {isResp && <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(a.id)}>🗑</button>}
                </div>
                <div className="text-sm" style={{ lineHeight:1.6, color:'var(--gray-700)' }}>{a.testo}</div>
                <div className="text-xs text-muted" style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span>{new Date(a.created_at).toLocaleDateString('it-IT')}</span>
                  {a.comunita_neo && <span className="badge badge-red">{a.comunita_neo.nome}</span>}
                  {a.profili && <span>· {a.profili.nome} {a.profili.cognome}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Nuovo Avviso</div>
            <div className="form-group"><label className="form-label">Titolo *</label><input className="form-control" value={form.titolo} onChange={e => setForm(f=>({...f,titolo:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Testo *</label><textarea className="form-control" rows={4} value={form.testo} onChange={e => setForm(f=>({...f,testo:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Comunità (facoltativo)</label>
              <select className="form-control" value={form.comunita_id} onChange={e => setForm(f=>({...f,comunita_id:e.target.value}))}>
                <option value="">Tutte le comunità</option>
                {comunita.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={pubblica} disabled={saving}>{saving ? 'Pubblicazione...' : 'Pubblica'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}