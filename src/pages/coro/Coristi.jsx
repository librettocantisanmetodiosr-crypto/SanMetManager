import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Coristi() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const canEdit = ['admin','parroco','responsabile_coro'].includes(profilo?.ruolo)
  const [coristi, setCoristi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ telefono: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('profili')
      .select('*')
      .in('ruolo', ['corista','responsabile_coro'])
      .eq('attivo', true)
      .order('cognome')
    setCoristi(data || [])
    setLoading(false)
  }

  const apriModifica = (c) => {
    setForm({ telefono: c.telefono || '', note: c.note || '' })
    setModal(c)
  }

  const salva = async () => {
    setSaving(true)
    const { error } = await supabase.from('profili').update({
      telefono: form.telefono.trim() || null,
      note: form.note.trim() || null,
    }).eq('id', modal.id)
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast('Corista aggiornato ✓', 'success'); setModal(null); carica() }
    setSaving(false)
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🎤 Coristi</h1>
        <div className="text-sm text-muted">{coristi.length} totali</div>
      </div>

      {canEdit && (
        <div style={{ background:'var(--blue-bg)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:'0.8rem', color:'var(--blue)' }}>
          Per aggiungere un corista vai in <strong>Admin → Utenti</strong> e assegna il ruolo <em>corista</em> o <em>responsabile coro</em>.
        </div>
      )}

      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {coristi.map(c => (
            <div key={c.id} className="card">
              <div className="card-body" style={{ padding:'13px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:800 }}>{c.cognome} {c.nome}</div>
                  {c.username && <div className="text-xs text-muted">@{c.username}</div>}
                  {c.telefono && (
                    <a href={`tel:${c.telefono}`} style={{ textDecoration:'none' }}>
                      <div className="text-sm text-muted">📞 {c.telefono}</div>
                    </a>
                  )}
                  {c.note && <div className="text-xs text-muted" style={{ marginTop:2 }}>{c.note}</div>}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span className={`badge ${c.ruolo === 'responsabile_coro' ? 'badge-gold' : 'badge-green'}`}>
                    {c.ruolo === 'responsabile_coro' ? 'Responsabile' : 'Corista'}
                  </span>
                  {canEdit && (
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => apriModifica(c)}>✏️</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {coristi.length === 0 && <div className="empty-state"><div className="icon">🎤</div><p>Nessun corista presente</p></div>}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Modifica corista</div>
            <div style={{ fontWeight:700, marginBottom:12 }}>{modal.cognome} {modal.nome}</div>
            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input type="tel" className="form-control" value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-control" rows={2} value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
