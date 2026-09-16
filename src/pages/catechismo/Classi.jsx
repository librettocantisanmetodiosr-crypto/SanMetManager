import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { logAzione } from '../../lib/logger'
import Icon from '../../components/Icon'

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
  const [conteggi, setConteggi] = useState({})

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

    // conteggio bambini attivi per classe
    const ids = (cl || []).map(c => c.id)
    if (ids.length) {
      const { data: bs } = await supabase.from('bambini')
        .select('classe_id').eq('attivo', true).in('classe_id', ids)
      const map = {}
      ;(bs || []).forEach(b => { map[b.classe_id] = (map[b.classe_id] || 0) + 1 })
      setConteggi(map)
    }
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
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <h1>Classi</h1>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={apriNuova} style={{ gap: 6 }}>
            <Icon name="classi" size={16} /> Nuova classe
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Caricamento…</div>
      ) : classi.length === 0 ? (
        <div className="empty-state"><Icon name="classi" size={44} style={{ color: 'var(--gray-300)' }} /><p style={{ marginTop: 12 }}>Nessuna classe ancora.<br />{isAdmin ? 'Creane una con il pulsante in alto.' : ''}</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {classi.map(c => {
            const cats = c.classi_catechisti?.map(cc => `${cc.profili?.nome} ${cc.profili?.cognome}`).join(', ') || 'Nessun catechista'
            const n = conteggi[c.id] || 0
            return (
              <div key={c.id} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="classi" size={21} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</h3>
                        <div className="text-xs text-muted">
                          {c.anno_cammino ? c.anno_cammino + ' · ' : ''}{c.giorno}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => apriModifica(c)} aria-label="Modifica">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                        </button>
                        <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(c.id)} aria-label="Elimina">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <span className="badge badge-green">{n} {n === 1 ? 'bambino' : 'bambini'}</span>
                    <span className="badge badge-gray">{c.classi_catechisti?.length || 0} catechist{(c.classi_catechisti?.length || 0) === 1 ? 'a' : 'i'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="coristi" size={15} style={{ color: 'var(--gray-500)', marginTop: 2 }} />
                    <span className="text-sm" style={{ color: cats === 'Nessun catechista' ? 'var(--gray-500)' : 'var(--gray-700)' }}>{cats}</span>
                  </div>
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
