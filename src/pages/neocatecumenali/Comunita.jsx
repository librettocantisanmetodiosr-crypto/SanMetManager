import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

export default function Comunita() {
  const { toast, ToastContainer } = useToast()
  const [comunita, setComunita] = useState([])
  const [membri, setMembri] = useState([])
  const [comunItaSelezionata, setComunitaSelezionata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalMembro, setModalMembro] = useState(null)
  const [form, setForm] = useState({ nome:'', anno_cammino:'', responsabile1:'', responsabile2:'', note:'' })
  const [formMembro, setFormMembro] = useState({ nome:'', cognome:'', telefono:'', anno_cammino:'', note:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { caricaComunita() }, [])
  useEffect(() => { if (comunItaSelezionata) caricaMembri(comunItaSelezionata) }, [comunItaSelezionata])

  const caricaComunita = async () => {
    setLoading(true)
    const { data } = await supabase.from('comunita_neo').select('*').order('nome')
    setComunita(data || [])
    if (data?.length > 0 && !comunItaSelezionata) setComunitaSelezionata(data[0].id)
    setLoading(false)
  }

  const caricaMembri = async (cid) => {
    const { data } = await supabase.from('membri_neo').select('*').eq('comunita_id', cid).order('cognome')
    setMembri(data || [])
  }

  const salvaComunita = async () => {
    if (!form.nome) return toast('Nome obbligatorio', 'error')
    setSaving(true)
    const { error } = modal === 'nuova'
      ? await supabase.from('comunita_neo').insert(form)
      : await supabase.from('comunita_neo').update(form).eq('id', modal.id)
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast('Salvato ✓', 'success'); setModal(null); caricaComunita() }
    setSaving(false)
  }

  const salvaMembro = async () => {
    if (!formMembro.nome || !formMembro.cognome) return toast('Nome e cognome obbligatori', 'error')
    setSaving(true)
    const dati = { ...formMembro, comunita_id: comunItaSelezionata }
    const { error } = modalMembro === 'nuovo'
      ? await supabase.from('membri_neo').insert(dati)
      : await supabase.from('membri_neo').update(dati).eq('id', modalMembro.id)
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast('Membro salvato ✓', 'success'); setModalMembro(null); caricaMembri(comunItaSelezionata) }
    setSaving(false)
  }

  const eliminaMembro = async (id) => {
    if (!window.confirm('Eliminare questo membro?')) return
    await supabase.from('membri_neo').delete().eq('id', id)
    toast('Membro eliminato', 'success'); caricaMembri(comunItaSelezionata)
  }

  const comSel = comunita.find(c => c.id === comunItaSelezionata)

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🕊️ Comunità</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ nome:'', anno_cammino:'', responsabile1:'', responsabile2:'', note:'' }); setModal('nuova') }}>＋ Nuova</button>
      </div>
      {/* Tabs comunita */}
      <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:16, paddingBottom:4 }}>
        {comunita.map(c => (
          <div key={c.id} onClick={() => setComunitaSelezionata(c.id)}
            style={{ flexShrink:0, background: comunItaSelezionata===c.id ? 'var(--red)' : '#fff',
              color: comunItaSelezionata===c.id ? '#fff' : 'var(--gray-700)',
              border:'1.5px solid', borderColor: comunItaSelezionata===c.id ? 'var(--red)' : 'var(--gray-200)',
              borderRadius:20, padding:'7px 16px', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            {c.nome}
          </div>
        ))}
      </div>
      {comSel && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-body">
            <div className="flex items-center justify-between" style={{ marginBottom:8 }}>
              <h3>{comSel.nome}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => { setForm({ nome:comSel.nome, anno_cammino:comSel.anno_cammino||'', responsabile1:comSel.responsabile1||'', responsabile2:comSel.responsabile2||'', note:comSel.note||'' }); setModal(comSel) }}>✏️</button>
            </div>
            {comSel.anno_cammino && <div className="text-sm text-muted">Anno di cammino: {comSel.anno_cammino}°</div>}
            {comSel.responsabile1 && <div className="text-sm text-muted">Responsabili: {comSel.responsabile1}{comSel.responsabile2 ? ' e '+comSel.responsabile2 : ''}</div>}
            <div className="text-sm" style={{ marginTop:6, color:'var(--red)', fontWeight:700 }}>{membri.length} membri</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <h3>Membri</h3>
        {comunItaSelezionata && <button className="btn btn-outline btn-sm" onClick={() => { setFormMembro({ nome:'', cognome:'', telefono:'', anno_cammino:'', note:'' }); setModalMembro('nuovo') }}>＋ Aggiungi</button>}
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {membri.map(m => (
            <div key={m.id} className="card">
              <div className="card-body" style={{ padding:'11px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{m.cognome} {m.nome}</div>
                  <div className="text-sm text-muted">{m.telefono || ''}{m.anno_cammino ? ` · Anno ${m.anno_cammino}°` : ''}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-outline btn-sm btn-icon" onClick={() => { setFormMembro({ nome:m.nome, cognome:m.cognome, telefono:m.telefono||'', anno_cammino:m.anno_cammino||'', note:m.note||'' }); setModalMembro(m) }}>✏️</button>
                  <button className="btn btn-red btn-sm btn-icon" onClick={() => eliminaMembro(m.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
          {membri.length === 0 && <div className="empty-state"><div className="icon">🕊️</div><p>Nessun membro</p></div>}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modal==='nuova' ? 'Nuova Comunità' : 'Modifica Comunità'}</div>
            <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Anno di cammino</label><input type="number" className="form-control" value={form.anno_cammino} onChange={e => setForm(f=>({...f,anno_cammino:e.target.value}))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Responsabile 1</label><input className="form-control" value={form.responsabile1} onChange={e => setForm(f=>({...f,responsabile1:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Responsabile 2</label><input className="form-control" value={form.responsabile2} onChange={e => setForm(f=>({...f,responsabile2:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salvaComunita} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
      {modalMembro && (
        <div className="modal-overlay" onClick={() => setModalMembro(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{modalMembro==='nuovo' ? 'Nuovo Membro' : 'Modifica Membro'}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={formMembro.nome} onChange={e => setFormMembro(f=>({...f,nome:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Cognome *</label><input className="form-control" value={formMembro.cognome} onChange={e => setFormMembro(f=>({...f,cognome:e.target.value}))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Telefono</label><input type="tel" className="form-control" value={formMembro.telefono} onChange={e => setFormMembro(f=>({...f,telefono:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Anno cammino</label><input type="number" className="form-control" value={formMembro.anno_cammino} onChange={e => setFormMembro(f=>({...f,anno_cammino:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalMembro(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salvaMembro} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}