// ═══════════════════════════════════════
// STUB PAGES — verranno completate
// ═══════════════════════════════════════

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

// ── BAMBINI ──
export function Bambini() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria'].includes(profilo?.ruolo)
  const [bambini, setBambini] = useState([])
  const [classi, setClassi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [cerca, setCerca] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')
  const vuoto = { nome:'', cognome:'', data_nascita:'', indirizzo:'', telefono1:'', telefono2:'', note:'', classe_id:'' }
  const [form, setForm] = useState(vuoto)
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [profilo])

  const carica = async () => {
    const { data: cl } = await supabase.from('classi').select('id, nome').eq('attiva', true).order('nome')
    setClassi(cl || [])
    let q = supabase.from('bambini').select('id, nome, cognome, data_nascita, telefono1, telefono2, note, classe_id, classi(nome)').eq('attivo', true).order('cognome')
    if (profilo?.ruolo === 'catechista') {
      const { data: cc } = await supabase.from('classi_catechisti').select('classe_id').eq('catechista_id', profilo.id)
      const ids = cc?.map(x => x.classe_id) || []
      if (ids.length > 0) q = q.in('classe_id', ids)
    }
    const { data } = await q
    setBambini(data || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) return toast('Nome e cognome obbligatori', 'error')
    setSaving(true)
    if (modal === 'nuovo') {
      await supabase.from('bambini').insert(form)
      toast('Bambino aggiunto ✓', 'success')
    } else {
      await supabase.from('bambini').update(form).eq('id', modal.id)
      toast('Bambino aggiornato ✓', 'success')
    }
    setSaving(false); setModal(null); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo bambino?')) return
    await supabase.from('bambini').update({ attivo: false }).eq('id', id)
    toast('Bambino eliminato', 'success'); carica()
  }

  const filtrati = bambini.filter(b => {
    const okNome = `${b.nome} ${b.cognome}`.toLowerCase().includes(cerca.toLowerCase())
    const okCl = !filtroClasse || b.classe_id === filtroClasse
    return okNome && okCl
  })

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4"><h1>👦 Bambini</h1>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => { setForm(vuoto); setModal('nuovo') }}>＋ Aggiungi</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="form-control" placeholder="🔍 Cerca…" value={cerca} onChange={e => setCerca(e.target.value)} style={{ flex: 1 }} />
        <select className="form-control" value={filtroClasse} onChange={e => setFiltroClasse(e.target.value)} style={{ width: 130 }}>
          <option value="">Tutte</option>
          {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrati.map(b => (
            <div key={b.id} className="card">
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 800 }}>{b.cognome} {b.nome}</div>
                    <div className="text-sm text-muted">{b.classi?.nome || '—'} {b.data_nascita ? '· n. '+new Date(b.data_nascita).toLocaleDateString('it-IT') : ''}</div>
                    {b.note && <div className="text-xs" style={{ color: 'var(--red)', marginTop: 2 }}>⚠️ {b.note}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => { setForm({ nome:b.nome, cognome:b.cognome, data_nascita:b.data_nascita||'', indirizzo:b.indirizzo||'', telefono1:b.telefono1||'', telefono2:b.telefono2||'', note:b.note||'', classe_id:b.classe_id||'' }); setModal(b) }}>✏️</button>
                    {isAdmin && <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(b.id)}>🗑</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtrati.length === 0 && <div className="empty-state"><div className="icon">👦</div><p>Nessun bambino trovato</p></div>}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Bambino' : 'Modifica Bambino'}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Cognome *</label><input className="form-control" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Data di nascita</label><input type="date" className="form-control" value={form.data_nascita} onChange={e => setForm(f => ({ ...f, data_nascita: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Classe</label>
                <select className="form-control" value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}>
                  <option value="">— nessuna —</option>
                  {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Indirizzo</label><input className="form-control" value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Telefono 1</label><input type="tel" className="form-control" value={form.telefono1} onChange={e => setForm(f => ({ ...f, telefono1: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Telefono 2</label><input type="tel" className="form-control" value={form.telefono2} onChange={e => setForm(f => ({ ...f, telefono2: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Note (allergie, patologie…)</label><textarea className="form-control" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PLACEHOLDER GENERICO ──
function Placeholder({ titolo, icon }) {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 16 }}>{icon} {titolo}</h1>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="icon">{icon}</div>
            <p>Sezione in costruzione.<br />Prossimamente disponibile!</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Date       = () => <Placeholder titolo="Gestione Date"      icon="📅" />
export const Utenti     = () => <Placeholder titolo="Gestione Utenti"    icon="👤" />
export const Bacheca    = () => <Placeholder titolo="Bacheca"            icon="📌" />
export const Calendario = () => <Placeholder titolo="Calendario"         icon="🗓️" />
export const Lettere    = () => <Placeholder titolo="Lettere"            icon="📄" />
export const Rubrica    = () => <Placeholder titolo="Rubrica"            icon="📇" />
export const Coristi    = () => <Placeholder titolo="Coristi"            icon="🎤" />
export const Comunita   = () => <Placeholder titolo="Comunità"          icon="🕊️" />
export const Stanze     = () => <Placeholder titolo="Prenotazione Stanze" icon="🚪" />
export const Avvisi     = () => <Placeholder titolo="Avvisi"             icon="📢" />
