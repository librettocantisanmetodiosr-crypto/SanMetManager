import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const fmtDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

export default function Date() {
  const { toast, ToastContainer } = useToast()
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [annoInizio, setAnnoInizio] = useState(new window.Date().getFullYear())
  const [annoFine, setAnnoFine] = useState(new window.Date().getFullYear() + 1)
  const [generando, setGenerando] = useState(false)
  const [modalManuale, setModalManuale] = useState(false)
  const [formManuale, setFormManuale] = useState({ data: '', tipo: 'extra', descrizione: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('date_catechismo').select('*').order('data', { ascending: false })
    setDate(data || [])
    setLoading(false)
  }

  const generaAutomatico = async () => {
    const inizio = parseInt(annoInizio)
    const fine = parseInt(annoFine)
    if (isNaN(inizio) || isNaN(fine) || fine <= inizio) {
      return toast('Anno fine deve essere maggiore di anno inizio', 'error')
    }
    setGenerando(true)
    try {
      // Genera tutti i sabati da ottobre anno_inizio a maggio anno_fine lato client
      const sabati = []
      const d = new window.Date(inizio, 9, 1)  // 1 ottobre
      const limFine = new window.Date(fine, 4, 31) // 31 maggio
      while (d <= limFine) {
        if (d.getDay() === 6) {
          sabati.push({
            data: fmtDate(d),
            tipo: 'ordinario',
            anno_inizio: inizio,
            anno_fine: fine,
          })
        }
        d.setDate(d.getDate() + 1)
      }
      if (sabati.length === 0) {
        toast('Nessun sabato trovato nel periodo', 'error')
        setGenerando(false)
        return
      }
      const { error } = await supabase
        .from('date_catechismo')
        .upsert(sabati, { onConflict: 'data' })
      if (error) throw error
      toast(`✓ ${sabati.length} sabati generati per ${inizio}/${fine}`, 'success')
      carica()
    } catch (e) {
      toast('Errore: ' + (e.message || 'controlla i permessi Supabase'), 'error')
    }
    setGenerando(false)
  }

  const aggiungiManuale = async () => {
    if (!formManuale.data) return toast('Inserisci la data', 'error')
    setSaving(true)
    const { error } = await supabase.from('date_catechismo').insert({
      data: formManuale.data,
      tipo: formManuale.tipo,
      descrizione: formManuale.descrizione || null,
      anno_inizio: parseInt(annoInizio),
      anno_fine: parseInt(annoFine),
    })
    if (error) toast(error.message.includes('unique') ? 'Data già presente' : 'Errore nel salvataggio', 'error')
    else { toast('Data aggiunta ✓', 'success'); carica() }
    setSaving(false)
    if (!error) setModalManuale(false)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa data?')) return
    await supabase.from('date_catechismo').delete().eq('id', id)
    toast('Data eliminata', 'success')
    carica()
  }

  const tipoBadge = (tipo) => {
    if (tipo === 'ordinario') return <span className="badge badge-green">Ordinario</span>
    if (tipo === 'extra')     return <span className="badge badge-blue">Extra</span>
    if (tipo === 'sospeso')   return <span className="badge badge-red">Sospeso</span>
    return <span className="badge badge-gray">{tipo}</span>
  }

  const perMese = date.reduce((acc, d) => {
    const mese = new window.Date(d.data + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    if (!acc[mese]) acc[mese] = []
    acc[mese].push(d)
    return acc
  }, {})

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <h1 style={{ marginBottom: 16 }}>📅 Gestione Date</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3>⚡ Genera automaticamente i sabati</h3></div>
        <div className="card-body">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Anno inizio</label>
              <input type="number" className="form-control" value={annoInizio}
                onChange={e => setAnnoInizio(parseInt(e.target.value) || annoInizio)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Anno fine</label>
              <input type="number" className="form-control" value={annoFine}
                onChange={e => setAnnoFine(parseInt(e.target.value) || annoFine)} />
            </div>
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: 10 }}>
            Genera tutti i sabati da ottobre {annoInizio} a maggio {annoFine}. Le date già presenti vengono saltate.
          </p>
          <button className="btn btn-primary btn-block" onClick={generaAutomatico} disabled={generando}>
            {generando
              ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Generazione…</>
              : `⚡ Genera sabati ${annoInizio}/${annoFine}`}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-outline btn-sm" onClick={() => { setFormManuale({ data: '', tipo: 'extra', descrizione: '' }); setModalManuale(true) }}>
          ＋ Data manuale
        </button>
      </div>

      {date.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[['ordinario','var(--primary)','var(--primary-bg)','ORDINARI'],
            ['extra','var(--blue)','var(--blue-bg)','EXTRA'],
            ['sospeso','var(--red)','var(--red-bg)','SOSPESI']].map(([tipo, color, bg, label]) => (
            <div key={tipo} style={{ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color }}>{date.filter(d => d.tipo === tipo).length}</div>
              <div style={{ fontSize: '0.65rem', color, fontWeight: 700 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loader"><div className="spinner" />Caricamento…</div>
      ) : date.length === 0 ? (
        <div className="empty-state"><div className="icon">📅</div><p>Nessuna data. Usa «Genera automaticamente».</p></div>
      ) : Object.entries(perMese).map(([mese, items]) => (
        <div key={mese} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {mese}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(d => (
              <div key={d.id} className="card">
                <div className="card-body" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {new window.Date(d.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </div>
                    {d.descrizione && <div className="text-sm text-muted" style={{ marginTop: 2 }}>{d.descrizione}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tipoBadge(d.tipo)}
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(d.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modalManuale && (
        <div className="modal-overlay" onClick={() => setModalManuale(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Aggiungi data manuale</div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input type="date" className="form-control" value={formManuale.data}
                onChange={e => setFormManuale(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={formManuale.tipo}
                onChange={e => setFormManuale(f => ({ ...f, tipo: e.target.value }))}>
                <option value="ordinario">Ordinario (incontro normale)</option>
                <option value="extra">Extra (incontro speciale)</option>
                <option value="sospeso">Sospeso (vacanza / pausa)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Descrizione (facoltativa)</label>
              <input className="form-control" value={formManuale.descrizione}
                onChange={e => setFormManuale(f => ({ ...f, descrizione: e.target.value }))}
                placeholder="Es: Incontro con i genitori" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalManuale(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={aggiungiManuale} disabled={saving}>
                {saving ? 'Salvataggio…' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
