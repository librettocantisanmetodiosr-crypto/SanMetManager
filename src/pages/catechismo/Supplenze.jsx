import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Supplenze() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [supplenze, setSupplenze] = useState([])
  const [classi, setClassi] = useState([])
  const [catechisti, setCatechisti] = useState([])
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ classe_id:'', catechista_supplente_id:'', data_id:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const [{ data: sup }, { data: cl }, { data: cat }, { data: dt }] = await Promise.all([
      supabase.from('supplenze').select(`
        id, created_at,
        classi(nome),
        profili!catechista_supplente_id(nome, cognome),
        date_catechismo(data),
        autorizzante:profili!autorizzato_da(nome, cognome)
      `).order('created_at', { ascending: false }),
      supabase.from('classi').select('id, nome').eq('attiva', true).order('nome'),
      supabase.from('profili').select('id, nome, cognome').eq('ruolo', 'catechista').eq('attivo', true).order('cognome'),
      supabase.from('date_catechismo').select('id, data').gte('data', new Date().toISOString().split('T')[0]).order('data').limit(15)
    ])
    setSupplenze(sup || [])
    setClassi(cl || [])
    setCatechisti(cat || [])
    setDate(dt || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.classe_id || !form.catechista_supplente_id || !form.data_id) return toast('Tutti i campi obbligatori', 'error')
    setSaving(true)
    await supabase.from('supplenze').insert({ ...form, autorizzato_da: profilo?.id })
    toast('Supplenza autorizzata ✓', 'success')
    setSaving(false); setModal(false); setForm({ classe_id:'', catechista_supplente_id:'', data_id:'' }); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Revocare questa supplenza?')) return
    await supabase.from('supplenze').delete().eq('id', id)
    toast('Supplenza revocata', 'success'); carica()
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🔄 Supplenze</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>＋ Autorizza</button>
      </div>

      <div style={{ background:'var(--blue-bg)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'0.82rem', color:'var(--blue)' }}>
        💡 Una supplenza permette a un catechista di accedere temporaneamente a una classe che non è la sua, solo per la data selezionata.
      </div>

      {loading ? <div className="loader"><div className="spinner"/></div> : supplenze.length === 0 ? (
        <div className="empty-state"><div className="icon">🔄</div><p>Nessuna supplenza attiva</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {supplenze.map(s => {
            const dataS = s.date_catechismo?.data
            const isPassata = dataS && new Date(dataS) < new Date()
            return (
              <div key={s.id} className="card" style={{ opacity: isPassata ? 0.6 : 1 }}>
                <div className="card-body" style={{ padding:'12px 14px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom:6 }}>
                    <div>
                      <div style={{ fontWeight:800 }}>
                        {s.profili?.nome} {s.profili?.cognome}
                        <span style={{ fontWeight:400, color:'var(--gray-500)' }}> → </span>
                        {s.classi?.nome}
                      </div>
                      <div className="text-sm text-muted">
                        📅 {dataS ? new Date(dataS).toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'long' }) : '—'}
                      </div>
                      {s.autorizzante && <div className="text-xs text-muted">Autorizzato da {s.autorizzante.nome} {s.autorizzante.cognome}</div>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                      {isPassata ? <span className="badge badge-gray">Passata</span> : <span className="badge badge-green">Attiva</span>}
                      {!isPassata && <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(s.id)}>✕</button>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Nuova Supplenza</div>
            <div className="form-group"><label className="form-label">Catechista supplente *</label>
              <select className="form-control" value={form.catechista_supplente_id} onChange={e => setForm(f=>({...f,catechista_supplente_id:e.target.value}))}>
                <option value="">— seleziona catechista —</option>
                {catechisti.map(c => <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Classe da supplire *</label>
              <select className="form-control" value={form.classe_id} onChange={e => setForm(f=>({...f,classe_id:e.target.value}))}>
                <option value="">— seleziona classe —</option>
                {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Data *</label>
              <select className="form-control" value={form.data_id} onChange={e => setForm(f=>({...f,data_id:e.target.value}))}>
                <option value="">— seleziona data —</option>
                {date.map(d => <option key={d.id} value={d.id}>{new Date(d.data).toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>{saving ? 'Salvataggio...' : 'Autorizza'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}