import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Presenze() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin','parroco','segreteria','responsabile'].some(r => tuttiRuoli.includes(r))

  const [classi, setClassi] = useState([])
  const [date, setDate] = useState([])
  const [bambini, setBambini] = useState([])
  const [presenze, setPresenze] = useState({}) // { bambino_id: 'P'|'A' }
  const [noteGiornata, setNoteGiornata] = useState('')

  const [classeId, setClasseId] = useState('')
  const [dataId, setDataId] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { caricaClassi() }, [profilo])
  useEffect(() => { if (classeId) caricaDate(); setBambini([]); setPresenze({}) }, [classeId])
  useEffect(() => { if (classeId && dataId) caricaBambiniEPresenze() }, [classeId, dataId])

  const caricaClassi = async () => {
    let q = supabase.from('classi').select('id, nome').eq('attiva', true).order('nome')
    if (!isAdmin && tuttiRuoli.includes('catechista')) {
      const { data: cc } = await supabase.from('classi_catechisti').select('classe_id').eq('catechista_id', profilo.id)
      const ids = cc?.map(x => x.classe_id) || []
      const oggi = new Date().toISOString().split('T')[0]
      const { data: dateOggi } = await supabase.from('date_catechismo').select('id').eq('data', oggi)
      const todayDateId = dateOggi?.[0]?.id
      const supIds = []
      if (todayDateId) {
        const { data: sup } = await supabase.from('supplenze')
          .select('classe_id')
          .eq('catechista_supplente_id', profilo.id)
          .eq('data_id', todayDateId)
        sup?.forEach(x => supIds.push(x.classe_id))
      }
      const tuttiIds = [...new Set([...ids, ...supIds])]
      if (tuttiIds.length > 0) {
        q = q.in('id', tuttiIds)
      } else {
        setClassi([]); return
      }
    }
    const { data } = await q
    setClassi(data || [])
    if (data?.length === 1) setClasseId(data[0].id)
  }

  const caricaDate = async () => {
    const { data } = await supabase
      .from('date_catechismo')
      .select('id, data, descrizione')
      .order('data', { ascending: false })
      .limit(20)
    setDate(data || [])
    if (data?.length > 0) setDataId(data[0].id)
  }

  const caricaBambiniEPresenze = async () => {
    setLoading(true)
    const { data: bamb } = await supabase
      .from('bambini')
      .select('id, nome, cognome')
      .eq('classe_id', classeId)
      .eq('attivo', true)
      .order('cognome')

    const { data: pres } = await supabase
      .from('presenze')
      .select('bambino_id, stato')
      .eq('data_id', dataId)
      .in('bambino_id', (bamb || []).map(b => b.id))

    const { data: nota } = await supabase
      .from('note_giornata')
      .select('testo')
      .eq('classe_id', classeId)
      .eq('data_id', dataId)
      .single()

    const map = {}
    pres?.forEach(p => { map[p.bambino_id] = p.stato })
    setBambini(bamb || [])
    setPresenze(map)
    setNoteGiornata(nota?.testo || '')
    setLoading(false)
  }

  const togglePresenza = (bambinoId, stato) => {
    setPresenze(p => ({ ...p, [bambinoId]: p[bambinoId] === stato ? '' : stato }))
  }

  const segnatutti = (stato) => {
    const map = {}
    bambini.forEach(b => { map[b.id] = stato })
    setPresenze(map)
  }

  const salva = async () => {
    if (!classeId || !dataId) return
    setSaving(true)
    // Salva presenze (upsert)
    const rows = bambini.map(b => ({
      bambino_id: b.id,
      data_id: dataId,
      stato: presenze[b.id] || 'A'
    }))
    const { error } = await supabase.from('presenze').upsert(rows, { onConflict: 'bambino_id,data_id' })

    // Salva note giornata
    if (noteGiornata.trim()) {
      await supabase.from('note_giornata').upsert({
        classe_id: classeId, data_id: dataId,
        catechista_id: profilo.id, testo: noteGiornata
      }, { onConflict: 'classe_id,data_id' })
    }

    setSaving(false)
    if (error) toast('Errore nel salvataggio', 'error')
    else toast('Presenze salvate ✓', 'success')
  }

  const presenti = bambini.filter(b => presenze[b.id] === 'P').length
  const assenti  = bambini.filter(b => presenze[b.id] === 'A').length
  const nonSegnati = bambini.length - presenti - assenti

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <h1 style={{ marginBottom: 16 }}>✅ Registro Presenze</h1>

      {/* Filtri */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Classe</label>
            <select className="form-control" value={classeId} onChange={e => setClasseId(e.target.value)}>
              <option value="">— seleziona classe —</option>
              {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Data incontro</label>
            <select className="form-control" value={dataId} onChange={e => setDataId(e.target.value)}>
              <option value="">— seleziona data —</option>
              {date.map(d => (
                <option key={d.id} value={d.id}>
                  {new Date(d.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                  {d.descrizione ? ` — ${d.descrizione}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats rapide */}
      {bambini.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>{presenti}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 700 }}>PRESENTI</div>
          </div>
          <div style={{ background: 'var(--red-bg)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--red)' }}>{assenti}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--red)', fontWeight: 700 }}>ASSENTI</div>
          </div>
          <div style={{ background: 'var(--gray-100)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--gray-500)' }}>{nonSegnati}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', fontWeight: 700 }}>DA SEGNARE</div>
          </div>
        </div>
      )}

      {/* Azioni rapide */}
      {bambini.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => segnatutti('P')}>✓ Tutti presenti</button>
          <button className="btn btn-red btn-sm" style={{ flex: 1 }} onClick={() => segnatutti('A')}>✗ Tutti assenti</button>
        </div>
      )}

      {/* Lista bambini */}
      {loading ? (
        <div className="loader"><div className="spinner" />Caricamento…</div>
      ) : bambini.length === 0 && classeId && dataId ? (
        <div className="empty-state"><div className="icon">👦</div><p>Nessun bambino in questa classe</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {bambini.map((b, i) => (
            <div key={b.id} className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ minWidth:20, fontSize:'0.72rem', fontWeight:700, color:'var(--gray-400)', flexShrink:0 }}>{i+1}</span>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.cognome} {b.nome}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => togglePresenza(b.id, 'P')}
                    style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none',
                      fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                      background: presenze[b.id] === 'P' ? 'var(--primary)' : 'var(--gray-100)',
                      color: presenze[b.id] === 'P' ? '#fff' : 'var(--gray-500)',
                      transition: 'all 0.15s'
                    }}
                  >P</button>
                  <button
                    onClick={() => togglePresenza(b.id, 'A')}
                    style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none',
                      fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                      background: presenze[b.id] === 'A' ? 'var(--red)' : 'var(--gray-100)',
                      color: presenze[b.id] === 'A' ? '#fff' : 'var(--gray-500)',
                      transition: 'all 0.15s'
                    }}
                  >A</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note giornata */}
      {bambini.length > 0 && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">📝 Note attività della giornata</label>
          <textarea
            className="form-control"
            placeholder="Es: Abbiamo parlato dei Sacramenti, lavorato sul foglio colorato…"
            value={noteGiornata}
            onChange={e => setNoteGiornata(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {/* Salva */}
      {bambini.length > 0 && (
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={salva}
          disabled={saving}
        >
          {saving ? <><div className="spinner" style={{ borderTopColor: '#fff' }} />Salvataggio…</> : '💾 Salva presenze'}
        </button>
      )}
    </div>
  )
}
