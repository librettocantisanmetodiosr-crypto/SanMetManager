import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { logAzione } from '../../lib/logger'

const vuota = { nome: '', anno_cammino: '', giorno: 'Sabato', note: '' }

export default function Classi() {
  const { profilo, tuttiRuoli } = useAuth()
  const isAdmin = ['admin','parroco','segreteria','responsabile'].some(r => tuttiRuoli.includes(r))
  const { toast, ToastContainer } = useToast()
  const [classi, setClassi] = useState([])
  const [catechisti, setCatechisti] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuova' | oggetto classe
  const [form, setForm] = useState(vuota)
  const [selectedCatechisti, setSelectedCatechisti] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [profilo])

  const carica = async () => {
    setLoading(true)

    let q = supabase.from('classi').select(`
      id, nome, anno_cammino, giorno, attiva, note,
      classi_catechisti(catechista_id, profili(nome, cognome))
    `).eq('attiva', true).order('nome')

    if (!isAdmin && tuttiRuoli.includes('catechista')) {
      const { data: cc } = await supabase.from('classi_catechisti')
        .select('classe_id').eq('catechista_id', profilo.id)
      const ids = (cc || []).map(x => x.classe_id)
      if (ids.length > 0) q = q.in('id', ids)
      else { setClassi([]); setCatechisti([]); setLoading(false); return }
    }

    const { data: cl } = await q

    // Catechisti assignable = ruolo catechista/responsabile OR ruoli_extra includes catechista
    const { data: tutti } = await supabase.from('profili')
      .select('id, nome, cognome, ruolo, ruoli_extra')
      .eq('attivo', true).order('cognome')
    const catOptions = (tutti || []).filter(p =>
      p.ruolo === 'catechista' || p.ruolo === 'responsabile' || (p.ruoli_extra || []).includes('catechista')
    )

    setClassi(cl || [])
    setCatechisti(catOptions)
    setLoading(false)
  }

  const apriNuova = () => {
    setForm(vuota)
    setSelectedCatechisti([])
    setModal('nuova')
  }

  const apriModifica = (c) => {
    setForm({ nome: c.nome, anno_cammino: c.anno_cammino || '', giorno: c.giorno || 'Sabato', note: c.note || '' })
    setSelectedCatechisti(c.classi_catechisti?.map(cc => cc.catechista_id) || [])
    setModal(c)
  }

  const toggleCatechista = (id) => {
    setSelectedCatechisti(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const salva = async () => {
    if (!form.nome.trim()) return toast('Inserisci il nome della classe', 'error')
    setSaving(true)

    let classeId
    if (modal === 'nuova') {
      const { data, error } = await supabase.from('classi').insert(form).select('id').single()
      if (error) { toast('Errore nel salvataggio', 'error'); setSaving(false); return }
      classeId = data.id
    } else {
      const { error } = await supabase.from('classi').update(form).eq('id', modal.id)
      if (error) { toast('Errore nel salvataggio', 'error'); setSaving(false); return }
      classeId = modal.id
    }

    await supabase.from('classi_catechisti').delete().eq('classe_id', classeId)
    if (selectedCatechisti.length > 0) {
      const rows = selectedCatechisti.map(cid => ({ classe_id: classeId, catechista_id: cid }))
      const { error: errCat } = await supabase.from('classi_catechisti').insert(rows)
      if (errCat) toast('Classe salvata ma errore nell\'assegnazione catechisti', 'error')
    }

    logAzione(modal === 'nuova' ? 'NUOVA_CLASSE' : 'MODIFICA_CLASSE', form.nome)
    toast(modal === 'nuova' ? 'Classe creata ✓' : 'Classe aggiornata ✓', 'success')
    setSaving(false)
    setModal(null)
    carica()
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
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={apriNuova}>＋ Nuova</button>}
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
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => apriModifica(c)}>✏️</button>
                        <button className="btn btn-red btn-sm" onClick={() => elimina(c.id)}>🗑</button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted">{c.anno_cammino && <span>Anno: {c.anno_cammino} · </span>}{c.giorno}</div>
                  <div className="text-sm" style={{ marginTop: 4 }}>👤 {cats}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

            <div className="form-group">
              <label className="form-label">Catechisti assegnati</label>
              {catechisti.length === 0 ? (
                <div className="text-sm text-muted">Nessun catechista disponibile</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  {catechisti.map(cat => {
                    const checked = selectedCatechisti.includes(cat.id)
                    return (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCatechista(cat.id)}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }}
                        />
                        <span>{cat.cognome} {cat.nome}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {selectedCatechisti.length > 0 && (
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {selectedCatechisti.length} selezionat{selectedCatechisti.length === 1 ? 'o' : 'i'}
                </div>
              )}
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
