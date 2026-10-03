import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'
import { GRUPPI_BACHECA, leggiDestinatari, scriviDestinatari, etichettaDestinatari } from '../../lib/bacheca'

const VUOTO = { id: null, titolo: '', testo: '', dest: ['tutti'] }

export default function Bacheca() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria','responsabile'].includes(profilo?.ruolo)
  const [avvisi, setAvvisi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VUOTO)
  const [saving, setSaving] = useState(false)
  const [persone, setPersone] = useState([])
  const [cerca, setCerca] = useState('')

  useEffect(() => { carica() }, [])
  useEffect(() => { if (isAdmin) caricaPersone() }, [isAdmin])

  // Ognuno riceve solo gli avvisi destinati a lui: il filtro lo fa il database
  const carica = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('bacheca').select('*, profili(nome,cognome)').eq('attivo', true).order('created_at', { ascending: false })
    if (error) toast('Errore nel caricamento degli avvisi', 'error')
    setAvvisi(data || [])
    setLoading(false)
  }

  const caricaPersone = async () => {
    const { data } = await supabase.from('profili').select('id, nome, cognome, attivo').order('cognome')
    setPersone((data || []).filter(p => p.attivo !== false))
  }

  const nuovo = () => { setForm(VUOTO); setCerca(''); setModal(true) }
  const modifica = (a) => {
    setForm({ id: a.id, titolo: a.titolo || '', testo: a.testo || '', dest: leggiDestinatari(a.destinatari) })
    setCerca(''); setModal(true)
  }

  // "Tutti" esclude le altre scelte; togliendo tutto si torna a "Tutti"
  const toggleDest = (valore) => setForm(f => {
    if (valore === 'tutti') return { ...f, dest: ['tutti'] }
    const senzaTutti = f.dest.filter(d => d !== 'tutti')
    const dest = senzaTutti.includes(valore) ? senzaTutti.filter(d => d !== valore) : [...senzaTutti, valore]
    return { ...f, dest: dest.length ? dest : ['tutti'] }
  })

  const salva = async () => {
    if (!form.titolo.trim() || !form.testo.trim()) return toast('Titolo e testo obbligatori', 'error')
    setSaving(true)
    const dati = { titolo: form.titolo.trim(), testo: form.testo.trim(), destinatari: scriviDestinatari(form.dest) }
    const { data, error } = form.id
      ? await supabase.from('bacheca').update(dati).eq('id', form.id).select('id')
      : await supabase.from('bacheca').insert({ ...dati, autore_id: profilo?.id }).select('id')
    setSaving(false)
    if (error || !data?.length) return toast('Salvataggio non riuscito: non hai i permessi o manca la connessione', 'error', 6000)
    toast(form.id ? 'Avviso aggiornato' : 'Avviso pubblicato', 'success')
    setModal(false); setForm(VUOTO); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo avviso?')) return
    const { data, error } = await supabase.from('bacheca').update({ attivo: false }).eq('id', id).select('id')
    if (error || !data?.length) return toast('Eliminazione non riuscita: non hai i permessi', 'error', 6000)
    toast('Avviso eliminato', 'success'); carica()
  }

  const personeScelte = persone.filter(p => form.dest.includes(`u:${p.id}`))
  const q = cerca.trim().toLowerCase()
  const personeTrovate = q
    ? persone.filter(p => `${p.nome} ${p.cognome} ${p.cognome} ${p.nome}`.toLowerCase().includes(q)).slice(0, 8)
    : []

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1 style={{ display:'flex', alignItems:'center', gap:8 }}><Icon name="bacheca" size={22} /> Bacheca</h1>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={nuovo} style={{ gap:6 }}>
            <Icon name="piu" size={16} strokeWidth={2} /> Avviso
          </button>
        )}
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : avvisi.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><Icon name="bacheca" size={34} /></div>
          <p>Nessun avviso presente</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {avvisi.map(a => (
            <div key={a.id} className="card" style={{ borderLeft:'4px solid var(--primary)' }}>
              <div className="card-body">
                <div className="flex items-center justify-between" style={{ marginBottom:6, gap:8 }}>
                  <div style={{ fontWeight:800, fontSize:'0.95rem' }}>{a.titolo}</div>
                  {isAdmin && (
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button className="btn btn-outline btn-sm btn-icon" onClick={() => modifica(a)} title="Modifica" aria-label="Modifica avviso">
                        <Icon name="modifica" size={16} />
                      </button>
                      <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(a.id)} title="Elimina" aria-label="Elimina avviso">
                        <Icon name="elimina" size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-sm" style={{ lineHeight:1.6, color:'var(--gray-700)', whiteSpace:'pre-line' }}>{a.testo}</div>
                <div className="text-xs text-muted" style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span>{new Date(a.created_at).toLocaleDateString('it-IT')}</span>
                  <span className="badge badge-green">{etichettaDestinatari(a.destinatari)}</span>
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
            <div className="modal-title">{form.id ? 'Modifica avviso' : 'Nuovo avviso'}</div>
            <div className="form-group"><label className="form-label">Titolo *</label><input className="form-control" value={form.titolo} onChange={e => setForm(f=>({...f,titolo:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Testo *</label><textarea className="form-control" rows={4} value={form.testo} onChange={e => setForm(f=>({...f,testo:e.target.value}))} /></div>

            <div className="form-group">
              <label className="form-label">Chi lo vede</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {GRUPPI_BACHECA.map(g => (
                  <button key={g.id} type="button" className={`chip ${form.dest.includes(g.id) ? 'on' : ''}`}
                    style={{ height:38, padding:'0 14px' }} onClick={() => toggleDest(g.id)}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Oppure a persone precise</label>
              {personeScelte.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {personeScelte.map(p => (
                    <button key={p.id} type="button" className="chip on" style={{ height:34, padding:'0 12px' }}
                      onClick={() => toggleDest(`u:${p.id}`)} title="Togli">
                      {p.nome} {p.cognome} ✕
                    </button>
                  ))}
                </div>
              )}
              <input className="form-control" placeholder="Cerca per nome…" value={cerca} onChange={e => setCerca(e.target.value)} />
              {personeTrovate.length > 0 && (
                <div style={{ border:'1px solid var(--gray-200)', borderRadius:10, marginTop:6, overflow:'hidden' }}>
                  {personeTrovate.map(p => {
                    const scelta = form.dest.includes(`u:${p.id}`)
                    return (
                      <button key={p.id} type="button" onClick={() => { toggleDest(`u:${p.id}`); setCerca('') }}
                        style={{ display:'flex', justifyContent:'space-between', width:'100%', padding:'10px 12px', border:'none', borderBottom:'1px solid var(--gray-100)', background: scelta ? 'var(--primary-bg)' : '#fff', cursor:'pointer', font:'inherit', textAlign:'left' }}>
                        <span>{p.cognome} {p.nome}</span>
                        <span className="text-xs text-muted">{scelta ? 'scelto' : 'aggiungi'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="text-xs text-muted" style={{ marginTop:6 }}>
                Destinatari: <b>{etichettaDestinatari(scriviDestinatari(form.dest))}</b>. La segreteria vede sempre tutti gli avvisi.
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salva} disabled={saving}>
                {saving ? 'Salvataggio...' : form.id ? 'Salva modifiche' : 'Pubblica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
