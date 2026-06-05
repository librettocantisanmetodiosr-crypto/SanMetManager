import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const COLORI = ['#1a6b3c','#2980b9','#8e44ad','#e67e22','#e74c3c','#16a085','#2c3e50','#f39c12']

const vuoto = { classe_id: '', data: new Date().toISOString().split('T')[0], titolo: '', testo: '' }

export default function AttivitaClasse() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria','responsabile'].some(r => tuttiRuoli.includes(r))

  const [classi, setClassi] = useState([])
  const [attivita, setAttivita] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vuoto)
  const [saving, setSaving] = useState(false)
  const [filtroClasse, setFiltroClasse] = useState('')

  useEffect(() => { if (profilo) carica() }, [profilo])

  const carica = async () => {
    setLoading(true)

    // Classi visibili all'utente
    let classiIds = null
    if (!isAdmin && tuttiRuoli.includes('catechista')) {
      const { data: cc } = await supabase.from('classi_catechisti')
        .select('classe_id').eq('catechista_id', profilo.id)
      classiIds = (cc || []).map(x => x.classe_id)
      if (classiIds.length === 0) { setClassi([]); setAttivita([]); setLoading(false); return }
    }

    let qClassi = supabase.from('classi').select('id, nome').eq('attiva', true).order('nome')
    if (classiIds) qClassi = qClassi.in('id', classiIds)
    const { data: cl } = await qClassi
    setClassi(cl || [])

    let qAtt = supabase.from('attivita_classe')
      .select('id, data, titolo, testo, classe_id, created_at, classi(nome), autore:profili(nome, cognome)')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
    if (classiIds) qAtt = qAtt.in('classe_id', classiIds)

    const { data: att } = await qAtt
    setAttivita(att || [])
    setLoading(false)
  }

  const apriNuovo = () => {
    setForm({ ...vuoto, classe_id: classi.length === 1 ? classi[0].id : '' })
    setModal('nuovo')
  }

  const apriModifica = (a) => {
    setForm({ classe_id: a.classe_id, data: a.data, titolo: a.titolo || '', testo: a.testo || '' })
    setModal(a)
  }

  const salva = async () => {
    if (!form.classe_id) return toast('Seleziona la classe', 'error')
    if (!form.testo.trim()) return toast('Inserisci il testo', 'error')
    setSaving(true)
    const dati = { classe_id: form.classe_id, data: form.data, titolo: form.titolo || null, testo: form.testo, autore_id: profilo.id }
    const { error } = modal === 'nuovo'
      ? await supabase.from('attivita_classe').insert(dati)
      : await supabase.from('attivita_classe').update({ titolo: form.titolo || null, testo: form.testo, data: form.data }).eq('id', modal.id)
    setSaving(false)
    if (error) return toast('Errore nel salvataggio', 'error')
    toast(modal === 'nuovo' ? 'Aggiunta ✓' : 'Aggiornata ✓', 'success')
    setModal(null)
    carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa nota?')) return
    await supabase.from('attivita_classe').delete().eq('id', id)
    toast('Eliminata', 'success')
    carica()
  }

  const filtrate = attivita.filter(a => !filtroClasse || a.classe_id === filtroClasse)

  // Raggruppa per data
  const perData = {}
  filtrate.forEach(a => {
    if (!perData[a.data]) perData[a.data] = []
    perData[a.data].push(a)
  })
  const dateOrdinate = Object.keys(perData).sort((a, b) => b.localeCompare(a))

  const coloreClasse = (id) => {
    const idx = classi.findIndex(c => c.id === id)
    return COLORI[idx % COLORI.length] || 'var(--primary)'
  }

  const fmtData = (d) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <h1>📝 Diario classi</h1>
        <button className="btn btn-primary btn-sm" onClick={apriNuovo}>＋ Aggiungi</button>
      </div>

      {/* Filtro classe */}
      {classi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          <button
            onClick={() => setFiltroClasse('')}
            style={{ flexShrink: 0, borderRadius: 20, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: '1.5px solid', background: !filtroClasse ? 'var(--primary)' : '#fff', color: !filtroClasse ? '#fff' : 'var(--gray-700)', borderColor: !filtroClasse ? 'var(--primary)' : 'var(--gray-200)' }}
          >Tutte</button>
          {classi.map(c => (
            <button
              key={c.id}
              onClick={() => setFiltroClasse(filtroClasse === c.id ? '' : c.id)}
              style={{ flexShrink: 0, borderRadius: 20, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: '1.5px solid', background: filtroClasse === c.id ? coloreClasse(c.id) : '#fff', color: filtroClasse === c.id ? '#fff' : 'var(--gray-700)', borderColor: filtroClasse === c.id ? coloreClasse(c.id) : 'var(--gray-200)' }}
            >{c.nome}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : dateOrdinate.length === 0 ? (
        <div className="empty-state"><div className="icon">📝</div><p>Nessuna attività ancora.<br />Aggiungi la prima nota!</p></div>
      ) : (
        dateOrdinate.map(data => (
          <div key={data} style={{ marginBottom: 20 }}>
            {/* Intestazione data */}
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', marginBottom: 8, paddingLeft: 2 }}>
              📅 {fmtData(data)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {perData[data].map(a => {
                const col = coloreClasse(a.classe_id)
                const puoModificare = isAdmin || a.autore_id === profilo?.id
                return (
                  <div key={a.id} className="card" style={{ borderLeft: `4px solid ${col}` }}>
                    <div className="card-body" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: a.titolo ? 4 : 0, flexWrap: 'wrap' }}>
                            <span style={{ background: col, color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{a.classi?.nome}</span>
                            {a.titolo && <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{a.titolo}</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--gray-800)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.testo}</p>
                          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                            {a.autore ? `${a.autore.nome} ${a.autore.cognome}` : 'Anonimo'}
                            {' · '}
                            {new Date(a.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {puoModificare && (
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <button className="btn btn-outline btn-sm btn-icon" onClick={() => apriModifica(a)}>✏️</button>
                            <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(a.id)}>🗑</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal aggiungi/modifica */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuovo' ? '📝 Nuova nota' : '✏️ Modifica nota'}</div>

            {classi.length > 1 && (
              <div className="form-group">
                <label className="form-label">Classe *</label>
                <select className="form-control" value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}>
                  <option value="">— seleziona —</option>
                  {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-control" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Titolo (opzionale)</label>
              <input className="form-control" placeholder="Es: Uscita, Battesimo, Ritiro…" value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Note / descrizione *</label>
              <textarea className="form-control" rows={4} placeholder="Descrivi l'attività, annotazioni, presenze particolari…" value={form.testo} onChange={e => setForm(f => ({ ...f, testo: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
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
