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

  const [classeId, setClasseId] = useState('')
  const [dataId, setDataId] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingIds, setSavingIds] = useState(new Set())
  const [modalDataExtra, setModalDataExtra] = useState(false)
  const [formDataExtra, setFormDataExtra] = useState({ data: new Date().toISOString().split('T')[0], descrizione: '' })
  const [savingData, setSavingData] = useState(false)

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
    const [resGlobali, resExtra] = await Promise.all([
      supabase.from('date_catechismo')
        .select('id, data, descrizione, classe_id')
        .is('classe_id', null)
        .order('data', { ascending: false })
        .limit(20),
      classeId
        ? supabase.from('date_catechismo')
            .select('id, data, descrizione, classe_id')
            .eq('classe_id', classeId)
            .order('data', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
    ])
    const tutte = [...(resGlobali.data || []), ...(resExtra.data || [])]
      .sort((a, b) => b.data.localeCompare(a.data))
    setDate(tutte)
    if (tutte.length > 0) setDataId(tutte[0].id)
  }

  const aggiungiDataExtra = async () => {
    if (!formDataExtra.data) return
    setSavingData(true)
    const { error } = await supabase.from('date_catechismo').insert({
      data: formDataExtra.data,
      descrizione: formDataExtra.descrizione.trim() || 'Incontro extra',
      classe_id: classeId,
    })
    setSavingData(false)
    if (error) return toast('Errore: ' + error.message, 'error')
    setModalDataExtra(false)
    setFormDataExtra({ data: new Date().toISOString().split('T')[0], descrizione: '' })
    caricaDate()
    toast('Data extra aggiunta ✓', 'success')
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

    const map = {}
    pres?.forEach(p => { map[p.bambino_id] = p.stato })
    setBambini(bamb || [])
    setPresenze(map)
    setLoading(false)
  }

  const togglePresenza = async (bambinoId, stato) => {
    const nuovoStato = presenze[bambinoId] === stato ? '' : stato
    setPresenze(p => ({ ...p, [bambinoId]: nuovoStato }))
    if (!dataId) return
    setSavingIds(prev => new Set(prev).add(bambinoId))
    if (nuovoStato) {
      await supabase.from('presenze').upsert(
        { bambino_id: bambinoId, data_id: dataId, stato: nuovoStato },
        { onConflict: 'bambino_id,data_id' }
      )
    } else {
      await supabase.from('presenze').delete()
        .eq('bambino_id', bambinoId).eq('data_id', dataId)
    }
    setSavingIds(prev => { const s = new Set(prev); s.delete(bambinoId); return s })
  }

  const salvaMap = async (map) => {
    if (!classeId || !dataId || bambini.length === 0) return
    setSaving(true)
    const rows = bambini.map(b => ({ bambino_id: b.id, data_id: dataId, stato: map[b.id] || 'A' }))
    const { error } = await supabase.from('presenze').upsert(rows, { onConflict: 'bambino_id,data_id' })
    setSaving(false)
    if (error) toast('Errore nel salvataggio', 'error')
    else toast('Presenze salvate ✓', 'success')
  }

  const segnatutti = async (stato) => {
    const map = {}
    bambini.forEach(b => { map[b.id] = stato })
    setPresenze(map)
    await salvaMap(map)
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Data incontro</label>
              {classeId && (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                  onClick={() => setModalDataExtra(true)}
                >＋ Data extra</button>
              )}
            </div>
            <select className="form-control" value={dataId} onChange={e => setDataId(e.target.value)}>
              <option value="">— seleziona data —</option>
              {date.map(d => (
                <option key={d.id} value={d.id}>
                  {d.classe_id ? '⭐ ' : ''}{new Date(d.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                  {d.descrizione ? ` — ${d.descrizione}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modal aggiunta data extra */}
      {modalDataExtra && (
        <div className="modal-overlay" onClick={() => setModalDataExtra(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">⭐ Aggiungi data extra</div>
            <p className="text-sm text-muted" style={{ marginBottom: 14 }}>
              Aggiungi una data di incontro extra solo per questa classe (es: incontro genitori, ritiro…).
            </p>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input type="date" className="form-control" value={formDataExtra.data}
                onChange={e => setFormDataExtra(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Descrizione</label>
              <input className="form-control" placeholder="Es: Incontro genitori, Ritiro..." value={formDataExtra.descrizione}
                onChange={e => setFormDataExtra(f => ({ ...f, descrizione: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalDataExtra(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={aggiungiDataExtra} disabled={savingData}>
                {savingData ? 'Salvataggio…' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    disabled={savingIds.has(b.id)}
                    style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none',
                      fontWeight: 800, fontSize: savingIds.has(b.id) ? '0.6rem' : '0.9rem', cursor: 'pointer',
                      background: presenze[b.id] === 'P' ? 'var(--primary)' : 'var(--gray-100)',
                      color: presenze[b.id] === 'P' ? '#fff' : 'var(--gray-500)',
                      transition: 'all 0.15s', opacity: savingIds.has(b.id) ? 0.7 : 1
                    }}
                  >{savingIds.has(b.id) ? '…' : 'P'}</button>
                  <button
                    onClick={() => togglePresenza(b.id, 'A')}
                    disabled={savingIds.has(b.id)}
                    style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none',
                      fontWeight: 800, fontSize: savingIds.has(b.id) ? '0.6rem' : '0.9rem', cursor: 'pointer',
                      background: presenze[b.id] === 'A' ? 'var(--red)' : 'var(--gray-100)',
                      color: presenze[b.id] === 'A' ? '#fff' : 'var(--gray-500)',
                      transition: 'all 0.15s', opacity: savingIds.has(b.id) ? 0.7 : 1
                    }}
                  >{savingIds.has(b.id) ? '…' : 'A'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Salva in batch (solo per "tutti presenti/assenti") */}
      {saving && (
        <div style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.85rem', padding: '10px 0' }}>
          <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />Salvataggio…
        </div>
      )}
    </div>
  )
}
