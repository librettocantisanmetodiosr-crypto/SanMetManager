import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const vuota = { nome: '', anno_cammino: '', giorno: 'Sabato', note: '' }

export default function Classi() {
  const { toast, ToastContainer } = useToast()
  const [classi, setClassi] = useState([])
  const [catechisti, setCatechisti] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuova' | oggetto classe
  const [form, setForm] = useState(vuota)
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data: cl } = await supabase.from('classi').select(`
      id, nome, anno_cammino, giorno, attiva,
      classi_catechisti(catechista_id, profili(nome, cognome))
    `).eq('attiva', true).order('nome')

    const { data: cat } = await supabase.from('profili')
      .select('id, nome, cognome').eq('ruolo', 'catechista').eq('attivo', true).order('cognome')

    setClassi(cl || [])
    setCatechisti(cat || [])
    setLoading(false)
  }

  const apriNuova = () => { setForm(vuota); setModal('nuova') }
  const apriModifica = (c) => {
    setForm({ nome: c.nome, anno_cammino: c.anno_cammino || '', giorno: c.giorno || 'Sabato', note: c.note || '' })
    setModal(c)
  }

  const salva = async () => {
    if (!form.nome.trim()) return toast('Inserisci il nome della classe', 'error')
    setSaving(true)
    if (modal === 'nuova') {
      const { error } = await supabase.from('classi').insert(form)
      if (error) toast('Errore nel salvataggio', 'error')
      else { toast('Classe creata ✓', 'success'); carica() }
    } else {
      const { error } = await supabase.from('classi').update(form).eq('id', modal.id)
      if (error) toast('Errore nel salvataggio', 'error')
      else { toast('Classe aggiornata ✓', 'success'); carica() }
    }
    setSaving(false)
    setModal(null)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa classe? I bambini assegnati perderanno l\'associazione.')) return
    await supabase.from('classi').update({ attiva: false }).eq('id', id)
    toast('Classe eliminata', 'success')
    carica()
  }

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <h1>🏫 Classi</h1>
        <button className="btn btn-primary btn-sm" onClick={apriNuova}>＋ Nuova</button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Caricamento…</div>
      ) : classi.length === 0 ? (
        <div className="empty-state"><div className="icon">🏫</div><p>Nessuna classe ancora.<br />Creane una!</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classi.map(c => {
            const cats = c.classi_catechisti?.map(cc => `${cc.profili?.nome} ${cc.profili?.cognome}`).join(', ') || '—'
            return (
              <div key={c.id} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <h3>{c.nome}</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => apriModifica(c)}>✏️</button>
                      <button className="btn btn-red btn-sm" onClick={() => elimina(c.id)}>🗑</button>
                    </div>
                  </div>
                  <div className="text-sm text-muted">{c.anno_cammino && <span>Anno: {c.anno_cammino} · </span>}{c.giorno}</div>
                  <div className="text-sm" style={{ marginTop: 4 }}>👤 {cats}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuova' ? 'Nuova Classe' : 'Modifica Classe'}</div>
            <div className="form-group">
              <label className="form-label">Nome classe *</label>
              <input className="form-control" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es: Prima A" />
            </div>
            <div className="form-group">
              <label className="form-label">Anno di cammino</label>
              <input className="form-control" value={form.anno_cammino} onChange={e => setForm(f => ({ ...f, anno_cammino: e.target.value }))} placeholder="Es: 1° anno" />
            </div>
            <div className="form-group">
              <label className="form-label">Giorno</label>
              <select className="form-control" value={form.giorno} onChange={e => setForm(f => ({ ...f, giorno: e.target.value }))}>
                <option>Sabato</option><option>Domenica</option><option>Mercoledì</option><option>Giovedì</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-control" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
