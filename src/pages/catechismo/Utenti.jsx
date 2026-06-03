import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const RUOLI = [
  { value:'admin', label:'Admin', badge:'badge-red' },
  { value:'parroco', label:'Parroco', badge:'badge-red' },
  { value:'segreteria', label:'Segreteria', badge:'badge-blue' },
  { value:'catechista', label:'Catechista', badge:'badge-green' },
  { value:'comitato', label:'Comitato', badge:'badge-blue' },
  { value:'responsabile_coro', label:'Resp. Coro', badge:'badge-gold' },
  { value:'corista', label:'Corista', badge:'badge-gold' },
  { value:'responsabile_neo', label:'Resp. Neo.', badge:'badge-blue' },
  { value:'neocatecumenale', label:'Neocatec.', badge:'badge-gray' },
]

export default function Utenti() {
  const { toast, ToastContainer } = useToast()
  const [utenti, setUtenti] = useState([])
  const [classi, setClassi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ username:'', nome:'', cognome:'', telefono:'', ruolo:'catechista' })
  const [saving, setSaving] = useState(false)
  const [filtroRuolo, setFiltroRuolo] = useState('')
  const [cerca, setCerca] = useState('')

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data: u } = await supabase.from('profili').select('*').eq('attivo', true).order('cognome')
    const { data: cl } = await supabase.from('classi').select('id, nome, classi_catechisti(catechista_id)').eq('attiva', true)
    setUtenti(u || [])
    setClassi(cl || [])
    setLoading(false)
  }

  const classiDiUtente = (uid) =>
    classi.filter(c => c.classi_catechisti?.some(cc => cc.catechista_id === uid)).map(c => c.nome).join(', ')

  const salvaModifica = async () => {
    if (!form.nome || !form.cognome) return toast('Nome e cognome obbligatori', 'error')
    setSaving(true)
    await supabase.from('profili').update({ username:form.username, nome:form.nome, cognome:form.cognome, telefono:form.telefono, ruolo:form.ruolo }).eq('id', modal.id)
    toast('Utente aggiornato', 'success')
    setSaving(false); setModal(null); carica()
  }

  const disattiva = async (uid) => {
    if (!window.confirm('Disattivare questo utente?')) return
    await supabase.from('profili').update({ attivo: false }).eq('id', uid)
    toast('Utente disattivato', 'success'); carica()
  }

  const badgeRuolo = (ruolo) => {
    const r = RUOLI.find(x => x.value === ruolo)
    return <span className={`badge ${r?.badge || 'badge-gray'}`}>{r?.label || ruolo}</span>
  }

  const filtrati = utenti.filter(u => {
    const okR = !filtroRuolo || u.ruolo === filtroRuolo
    const okC = !cerca || `${u.nome} ${u.cognome} ${u.username}`.toLowerCase().includes(cerca.toLowerCase())
    return okR && okC
  })

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <h1>👤 Utenti</h1>
        <span className="badge badge-gray">{utenti.length} totali</span>
      </div>
      <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:16, paddingBottom:4 }}>
        {RUOLI.filter(r => utenti.some(u => u.ruolo === r.value)).map(r => (
          <div key={r.value} onClick={() => setFiltroRuolo(filtroRuolo === r.value ? '' : r.value)}
            style={{ flexShrink:0, background: filtroRuolo===r.value ? 'var(--primary)' : '#fff',
              color: filtroRuolo===r.value ? '#fff' : 'var(--gray-700)',
              border:'1.5px solid', borderColor: filtroRuolo===r.value ? 'var(--primary)' : 'var(--gray-200)',
              borderRadius:20, padding:'6px 14px', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            {r.label} ({utenti.filter(u=>u.ruolo===r.value).length})
          </div>
        ))}
      </div>
      <input className="form-control" placeholder="Cerca utente..." value={cerca} onChange={e => setCerca(e.target.value)} style={{ marginBottom:14 }} />
      <div style={{ background:'var(--blue-bg)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:'0.8rem', color:'var(--blue)' }}>
        Per aggiungere utenti: Supabase → Authentication → Invite user
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtrati.map(u => (
            <div key={u.id} className="card">
              <div className="card-body" style={{ padding:'13px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom:4 }}>
                  <div>
                    <div style={{ fontWeight:800 }}>{u.nome} {u.cognome}</div>
                    <div className="text-xs text-muted">@{u.username}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {badgeRuolo(u.ruolo)}
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => { setForm({ username:u.username||'', nome:u.nome||'', cognome:u.cognome||'', telefono:u.telefono||'', ruolo:u.ruolo }); setModal(u) }}>✏️</button>
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => disattiva(u.id)}>🗑</button>
                  </div>
                </div>
                {u.telefono && <div className="text-sm text-muted">📞 {u.telefono}</div>}
                {u.ruolo==='catechista' && classiDiUtente(u.id) && <div className="text-sm" style={{ color:'var(--primary)', marginTop:2 }}>🏫 {classiDiUtente(u.id)}</div>}
              </div>
            </div>
          ))}
          {filtrati.length === 0 && <div className="empty-state"><div className="icon">👤</div><p>Nessun utente trovato</p></div>}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Modifica Utente</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nome</label><input className="form-control" value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Cognome</label><input className="form-control" value={form.cognome} onChange={e => setForm(f=>({...f,cognome:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Username</label><input className="form-control" value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Telefono</label><input type="tel" className="form-control" value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Ruolo</label>
              <select className="form-control" value={form.ruolo} onChange={e => setForm(f=>({...f,ruolo:e.target.value}))}>
                {RUOLI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salvaModifica} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}