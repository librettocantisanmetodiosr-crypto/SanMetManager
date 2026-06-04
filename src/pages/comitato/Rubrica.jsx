import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

const vuoto = { nome_ente: '', referente: '', email: '', telefono: '', note: '' }

// Parrocchie del Vicariato Urbano di Siracusa (fonte: Arcidiocesi di Siracusa, 2024)
const PARROCCHIE_SIRACUSA = [
  { nome_ente: 'Cattedrale — Metropolitana Natività di Maria SS.ma', referente: 'Parroco', indirizzo: 'Piazza Duomo, 5', telefono: '0931 65328', email: 'cattedrale.siracusa@alice.it' },
  { nome_ente: 'Basilica Santuario Madonna delle Lacrime', referente: 'Rettore', indirizzo: 'Via del Santuario, 33', telefono: '0931 21446', email: 'rettore@madonnadellelacrime.it' },
  { nome_ente: 'Maria Madre della Chiesa', referente: 'Parroco', indirizzo: 'Via Alessandro Specchi, 98', telefono: '0931 702755', email: '' },
  { nome_ente: 'Maria Madre di Dio', referente: 'Parroco', indirizzo: 'Viale San Panagia, 135', telefono: '0931 757544', email: '' },
  { nome_ente: 'Maria SS.ma Addolorata (Grottasanta)', referente: 'Parroco', indirizzo: 'Via dei Servi di Maria, 8', telefono: '0931 1622769', email: 'parrocchiagrottasanta@gmail.com' },
  { nome_ente: 'Maria SS.ma Mediatrice di tutte le Grazie', referente: 'Parroco', indirizzo: 'Contrada Isola', telefono: '389 4455602', email: '' },
  { nome_ente: 'Maria SS.ma della Misericordia e dei Pericoli', referente: 'Parroco', indirizzo: 'Piazza Cappuccini, 2', telefono: '0931 33338', email: '' },
  { nome_ente: 'Maria Stella del Mare', referente: 'Parroco', indirizzo: 'Via Tersicore, 15 (Fontane Bianche)', telefono: '', email: '' },
  { nome_ente: 'Sant\'Antonio di Padova', referente: 'Parroco', indirizzo: 'Via A. Lo Surdo, 13', telefono: '0931 492822', email: 's.antoniosr@alice.it' },
  { nome_ente: 'San Corrado Confalonieri', referente: 'Parroco', indirizzo: 'Piazza Tor di San Francesco', telefono: '0931 704104', email: 'sancorrado@virgilio.it' },
  { nome_ente: 'San Francesco d\'Assisi', referente: 'Parroco', indirizzo: 'Viale Epipoli', telefono: '0931 740458', email: '' },
  { nome_ente: 'San Giacomo Apostolo ai Miracoli', referente: 'Parroco', indirizzo: 'Via dei Miracoli', telefono: '0931 65210', email: '' },
  { nome_ente: 'San Giovanni Battista all\'Immacolata', referente: 'Parroco', indirizzo: 'Piazza San Filippo', telefono: '0931 67017', email: 'parrocchiaimmacolasr@gmail.com' },
  { nome_ente: 'San Giovanni Evangelista e San Marziano', referente: 'Parroco', indirizzo: 'Piazzale S. Marziano', telefono: '346 1238715', email: '' },
  { nome_ente: 'San Giuseppe (Cassibile)', referente: 'Parroco', indirizzo: 'Via Fiume Cacipari, 8', telefono: '0931 718895', email: '' },
  { nome_ente: 'San Luca', referente: 'Parroco', indirizzo: 'Via Testaferrata, 1 (Osp. Umberto I)', telefono: '0931 724083', email: '' },
  { nome_ente: 'Santa Lucia al Sepolcro', referente: 'Parroco', indirizzo: 'Via Luigi Bignami, 1', telefono: '0931 67946', email: 'parrocchia@basilicasantalucia.com' },
  { nome_ente: 'Santa Maria della Consolazione (Belvedere)', referente: 'Parroco', indirizzo: 'Via Poggio del Carancino, 62', telefono: '0931 711381', email: 's.mariaconsolazionebelvedere@gmail.com' },
  { nome_ente: 'San Martino Vescovo', referente: 'Parroco', indirizzo: 'Via San Martino, 1', telefono: '0931 24385', email: '' },
  { nome_ente: 'San Metodio', referente: 'Parroco', indirizzo: 'Piazza San Metodio, 1 (Via Italia, 103)', telefono: '0931 705664', email: 'parrocchiasanmetodio@email.it' },
  { nome_ente: 'San Paolo Apostolo', referente: 'Parroco', indirizzo: 'Via dell\'Apollonion', telefono: '', email: '' },
  { nome_ente: 'San Pietro al Carmine', referente: 'Parroco', indirizzo: 'Piazza del Carmine', telefono: '0931 66056', email: 'g.lombardo.sr@gmail.com' },
  { nome_ente: 'Santa Rita', referente: 'Parroco', indirizzo: 'Corso Gelone, 93', telefono: '0931 66151', email: 'rita.santa@virgilio.it' },
  { nome_ente: 'San Tommaso Apostolo al Pantheon', referente: 'Parroco', indirizzo: 'Via A. Diaz, 1', telefono: '0931 60100', email: '' },
  { nome_ente: 'Sacra Famiglia', referente: 'Parroco', indirizzo: 'Viale dei Comuni, 14', telefono: '0931 758370', email: 'parrocchia.sfamiglia@alice.it' },
  { nome_ente: 'Sacro Cuore di Gesù', referente: 'Parroco', indirizzo: 'Piazza Giovanni XXIII', telefono: '0931 36311', email: 'sacro.cuore@asweb.it' },
  { nome_ente: 'Santissimo Salvatore', referente: 'Parroco', indirizzo: 'Via Necropoli Grotticelle, 60', telefono: '0931 414844', email: '' },
]

export default function Rubrica() {
  const { toast, ToastContainer } = useToast()
  const [contatti, setContatti] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vuoto)
  const [cerca, setCerca] = useState('')
  const [saving, setSaving] = useState(false)
  const [importando, setImportando] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('rubrica').select('*').order('nome_ente')
    setContatti(data || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.nome_ente.trim()) return toast('Nome ente obbligatorio', 'error')
    setSaving(true)
    const dati = {
      nome_ente: form.nome_ente.trim(),
      referente: form.referente.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      note: form.note.trim() || null,
    }
    const { error } = modal === 'nuovo'
      ? await supabase.from('rubrica').insert(dati)
      : await supabase.from('rubrica').update(dati).eq('id', modal.id)
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast(modal === 'nuovo' ? 'Contatto aggiunto ✓' : 'Contatto aggiornato ✓', 'success'); setModal(null) }
    setSaving(false)
    carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo contatto?')) return
    await supabase.from('rubrica').delete().eq('id', id)
    toast('Contatto eliminato', 'success')
    carica()
  }

  const importaParrocchie = async () => {
    if (!window.confirm(`Importare tutte le ${PARROCCHIE_SIRACUSA.length} parrocchie del Vicariato di Siracusa?\nI duplicati verranno saltati automaticamente.`)) return
    setImportando(true)
    let importati = 0
    let saltati = 0
    for (const p of PARROCCHIE_SIRACUSA) {
      // Controlla se esiste già
      const { data: exists } = await supabase
        .from('rubrica')
        .select('id')
        .eq('nome_ente', p.nome_ente)
        .single()
      if (exists) { saltati++; continue }
      const { error } = await supabase.from('rubrica').insert({
        nome_ente: p.nome_ente,
        referente: p.referente || null,
        email: p.email || null,
        telefono: p.telefono || null,
        note: p.indirizzo ? `Indirizzo: ${p.indirizzo}` : null,
      })
      if (!error) importati++
    }
    setImportando(false)
    carica()
    if (importati > 0) toast(`✓ ${importati} parrocchie importate${saltati > 0 ? ` (${saltati} già presenti)` : ''}`, 'success', 4000)
    else toast(`Tutte le parrocchie erano già presenti (${saltati})`, 'default')
  }

  const filtrati = contatti.filter(c =>
    !cerca || `${c.nome_ente} ${c.referente || ''} ${c.email || ''}`.toLowerCase().includes(cerca.toLowerCase())
  )

  const parrocchieCount = contatti.filter(c =>
    PARROCCHIE_SIRACUSA.some(p => p.nome_ente === c.nome_ente)
  ).length
  const tuteImportate = parrocchieCount === PARROCCHIE_SIRACUSA.length

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <h1>📇 Rubrica</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!tuteImportate && (
            <button
              className="btn btn-outline btn-sm"
              onClick={importaParrocchie}
              disabled={importando}
            >
              {importando
                ? <><div className="spinner" style={{ width: 14, height: 14 }} />Importazione…</>
                : `⛪ Importa parrocchie`
              }
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(vuoto); setModal('nuovo') }}>
            ＋ Aggiungi
          </button>
        </div>
      </div>

      {!tuteImportate && (
        <div style={{ background: 'var(--blue-bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.8rem', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⛪</span>
          <span>
            {parrocchieCount === 0
              ? `Premi «Importa parrocchie» per aggiungere le ${PARROCCHIE_SIRACUSA.length} parrocchie del Vicariato di Siracusa in un click.`
              : `${PARROCCHIE_SIRACUSA.length - parrocchieCount} parrocchie ancora da importare.`
            }
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="form-control"
          placeholder="🔍 Cerca contatto..."
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          style={{ flex: 1 }}
        />
        <span className="badge badge-gray" style={{ alignSelf: 'center', flexShrink: 0 }}>
          {filtrati.length} contatti
        </span>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrati.map(c => (
            <div key={c.id} className="card">
              <div className="card-body" style={{ padding: '13px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: c.referente || c.email || c.telefono ? 6 : 0 }}>
                  <div style={{ fontWeight: 800, flex: 1, marginRight: 8, fontSize: '0.92rem' }}>{c.nome_ente}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => {
                      setForm({ nome_ente: c.nome_ente, referente: c.referente || '', email: c.email || '', telefono: c.telefono || '', note: c.note || '' })
                      setModal(c)
                    }}>✏️</button>
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(c.id)}>🗑</button>
                  </div>
                </div>
                {c.referente && <div className="text-sm text-muted">👤 {c.referente}</div>}
                {c.email && (
                  <a href={`mailto:${c.email}`} style={{ textDecoration: 'none' }}>
                    <div className="text-sm" style={{ color: 'var(--blue)', marginTop: 2 }}>✉️ {c.email}</div>
                  </a>
                )}
                {c.telefono && (
                  <a href={`tel:${c.telefono}`} style={{ textDecoration: 'none' }}>
                    <div className="text-sm text-muted">📞 {c.telefono}</div>
                  </a>
                )}
                {c.note && <div className="text-xs text-muted" style={{ marginTop: 3 }}>📍 {c.note}</div>}
              </div>
            </div>
          ))}
          {filtrati.length === 0 && (
            <div className="empty-state"><div className="icon">📇</div><p>Nessun contatto trovato</p></div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Contatto' : 'Modifica Contatto'}</div>
            <div className="form-group">
              <label className="form-label">Nome ente / persona *</label>
              <input className="form-control" value={form.nome_ente}
                onChange={e => setForm(f => ({ ...f, nome_ente: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Referente</label>
              <input className="form-control" value={form.referente}
                onChange={e => setForm(f => ({ ...f, referente: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input type="tel" className="form-control" value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Note / Indirizzo</label>
              <textarea className="form-control" rows={2} value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
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
