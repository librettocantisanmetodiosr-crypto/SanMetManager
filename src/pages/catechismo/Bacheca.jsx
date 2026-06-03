import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const DEST = ['tutti','catechisti','segreteria','comitato','coro','neocatecumenali']

export default function Bacheca() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria'].includes(profilo?.ruolo)
  const [avvisi, setAvvisi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titolo:'', testo:'', destinatari:'tutti' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('bacheca').select('*, profili(nome,cognome)').eq('attivo', true).order('created_at', { ascending: false })
    setAvvisi(data || [])
    setLoading(false)
  }

  const pubblica = async () => {
    if (!form.titolo || !form.testo) return toast('Titolo e testo obbligatori', 'error')
    setSaving(true)
    await supabase.from('bacheca').insert({ ...form, autore_id: profilo?.id })
    toast('Avviso pubblicato', 'success')
    setSaving(false); setModal(false); setForm({ titolo:'', testo:'', destinatari:'tutti' }); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo avviso?')) return
    await supabase.from('bacheca').update({ attivo: false }).eq('id', id)
    toast('Avviso eliminato', 'success'); carica()
  }

  const colori = { tutti:'var(--primary)', catechisti:'var(--blue)', segreteria:'var(--red)', comitato:'var(--blue)', coro:'#f59e0b', neocatecumenali:'var(--red)' }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>📌 Bacheca</h1>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>＋ Avviso</button>}
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : avvisi.length === 0 ? (
        <div className="empty-state"><div className="icon">📌</div><p>Nessun avviso presente</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {avvisi.map(a => (
            <div key={a.id} className="card" style={{ borderLeft:`4px solid ${colori[a.destinatari]||'var(--primary)'}` }}>
              <div className="card-body">
                <div className="flex items-center justify-between" style={{ marginBottom:6 }}>
                  <div style={{ fontWeight:800, fontSize:'0.95rem' }}>{a.titolo}</div>
                  {isAdmin && <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(a.id)}>🗑</button>}
                </div>
                <div className="text-sm" style={{ lineHeight:1.6, color:'var(--gray-700)' }}>{a.testo}</div>
                <div className="text-xs text-muted" style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                  <span>{new Date(a.created_at).toLocaleDateString('it-IT')}</span>
                  <span className="badge badge-green">{a.destinatari}</span>
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
            <div className="form-group"><label className="form-label">Destinatari</label>
              <select className="form-control" value={form.destinatari} onChange={e => setForm(f=>({...f,destinatari:e.target.value}))}>
                {DEST.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
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