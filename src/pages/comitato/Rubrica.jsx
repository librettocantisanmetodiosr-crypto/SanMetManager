import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const vuoto = { nome_ente:'', referente:'', email:'', telefono:'', note:'' }

export default function Rubrica() {
  const { toast, ToastContainer } = useToast()
  const [contatti, setContatti] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vuoto)
  const [cerca, setCerca] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('rubrica').select('*').order('nome_ente')
    setContatti(data || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.nome_ente) return toast('Nome ente obbligatorio', 'error')
    setSaving(true)
    if (modal === 'nuovo') await supabase.from('rubrica').insert(form)
    else await supabase.from('rubrica').update(form).eq('id', modal.id)
    toast(modal === 'nuovo' ? 'Contatto aggiunto' : 'Contatto aggiornato', 'success')
    setSaving(false); setModal(null); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo contatto?')) return
    await supabase.from('rubrica').delete().eq('id', id)
    toast('Contatto eliminato', 'success'); carica()
  }

  const filtrati = contatti.filter(c =>
    !cerca || `${c.nome_ente} ${c.referente} ${c.email}`.toLowerCase().includes(cerca.toLowerCase())
  )

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>📇 Rubrica</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(vuoto); setModal('nuovo') }}>＋ Aggiungi</button>
      </div>
      <input className="form-control" placeholder="Cerca contatto..." value={cerca} onChange={e => setCerca(e.target.value)} style={{ marginBottom:14 }} />
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtrati.map(c => (
            <div key={c.id} className="card">
              <div className="card-body" style={{ padding:'13px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom:4 }}>
                  <div style={{ fontWeight:800 }}>{c.nome_ente}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => { setForm({ nome_ente:c.nome_ente, referente:c.referente||'', email:c.email||'', telefono:c.telefono||'', note:c.note||'' }); setModal(c) }}>✏️</button>
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(c.id)}>🗑</button>
                  </div>
                </div>
                {c.referente && <div className="text-sm text-muted">👤 {c.referente}</div>}
                {c.email && <div className="text-sm" style={{ color:'var(--blue)' }}>✉️ {c.email}</div>}
                {c.telefono && <div className="text-sm text-muted">📞 {c.telefono}</div>}
              </div>
            </div>
          ))}
          {filtrati.length === 0 && <div className="empty-state"><div className="icon">📇</div><p>Nessun contatto trovato</p></div>}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Contatto' : 'Modifica Contatto'}</div>
            <div className="form-group"><label className="form-label">Nome ente / persona *</label><input className="form-control" value={form.nome_ente} onChange={e => setForm(f=>({...f,nome_ente:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Referente</label><input className="form-control" value={form.referente} onChange={e => setForm(f=>({...f,referente:e.target.value}))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Telefono</label><input type="tel" className="form-control" value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} /></div>
            </div>
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