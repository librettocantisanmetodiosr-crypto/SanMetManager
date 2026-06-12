import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Scalette() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isResp = ['admin','parroco','responsabile_coro'].includes(profilo?.ruolo)

  const [scalette, setScalette] = useState([])
  const [canti, setCanti] = useState([])
  const [loading, setLoading] = useState(true)
  const [scalettaAperta, setScalettaAperta] = useState(null)
  const [cantiScaletta, setCantiScaletta] = useState([])
  const [modalNuova, setModalNuova] = useState(false)
  const [modalAggiungi, setModalAggiungi] = useState(false)
  const [form, setForm] = useState({ nome: '', data: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const [cantoAttivo, setCantoAttivo] = useState(null)

  useEffect(() => { caricaScalette(); caricaCanti(); caricaCantoAttivo() }, [])

  const caricaScalette = async () => {
    const { data } = await supabase
      .from('scalette')
      .select('*, profili(nome, cognome)')
      .order('created_at', { ascending: false })
    setScalette(data || [])
    setLoading(false)
  }

  const caricaCanti = async () => {
    const { data } = await supabase.from('canti').select('id, titolo, categoria, tonalita').order('titolo')
    setCanti(data || [])
  }

  const caricaCantoAttivo = async () => {
    const { data } = await supabase.from('canto_attivo').select('canto_id').eq('id', 1).maybeSingle()
    setCantoAttivo(data?.canto_id ?? null)
  }

  const caricaCantiScaletta = async (scalettaId) => {
    const { data } = await supabase
      .from('scalette_canti')
      .select('id, ordine, canti(id, titolo, categoria, tonalita)')
      .eq('scaletta_id', scalettaId)
      .order('ordine')
    setCantiScaletta(data || [])
  }

  const apriScaletta = async (s) => {
    setScalettaAperta(s)
    await caricaCantiScaletta(s.id)
  }

  const creaScaletta = async () => {
    if (!form.nome.trim()) return toast('Inserisci un nome', 'error')
    setSaving(true)
    const { data, error } = await supabase
      .from('scalette')
      .insert({ nome: form.nome.trim(), data: form.data || null, note: form.note || null, autore_id: profilo?.id })
      .select()
      .single()
    if (error) { toast('Errore: ' + error.message, 'error'); setSaving(false); return }
    toast('Scaletta creata ✓', 'success')
    setSaving(false); setModalNuova(false); setForm({ nome: '', data: '', note: '' })
    await caricaScalette()
    apriScaletta(data)
  }

  const eliminaScaletta = async (id) => {
    if (!window.confirm('Eliminare questa scaletta?')) return
    await supabase.from('scalette').delete().eq('id', id)
    toast('Scaletta eliminata', 'success')
    caricaScalette()
    if (scalettaAperta?.id === id) setScalettaAperta(null)
  }

  const aggiungiCanto = async (cantoId) => {
    const maxOrdine = cantiScaletta.length > 0 ? Math.max(...cantiScaletta.map(x => x.ordine)) + 1 : 0
    const { error } = await supabase.from('scalette_canti')
      .insert({ scaletta_id: scalettaAperta.id, canto_id: cantoId, ordine: maxOrdine })
    if (error) {
      if (error.code === '23505') toast('Canto già nella scaletta', 'error')
      else toast('Errore: ' + error.message, 'error')
      return
    }
    toast('Aggiunto ✓', 'success'); setModalAggiungi(false); setCerca('')
    await caricaCantiScaletta(scalettaAperta.id)
  }

  const rimuoviCanto = async (scId) => {
    await supabase.from('scalette_canti').delete().eq('id', scId)
    await caricaCantiScaletta(scalettaAperta.id)
  }

  const spostaCanto = async (idx, dir) => {
    const list = [...cantiScaletta]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= list.length) return
    const [aId, aOrd, bId, bOrd] = [list[idx].id, list[idx].ordine, list[swapIdx].id, list[swapIdx].ordine]
    list[idx] = { ...list[idx], ordine: bOrd }
    list[swapIdx] = { ...list[swapIdx], ordine: aOrd }
    await Promise.all([
      supabase.from('scalette_canti').update({ ordine: bOrd }).eq('id', aId),
      supabase.from('scalette_canti').update({ ordine: aOrd }).eq('id', bId),
    ])
    list.sort((a, b) => a.ordine - b.ordine)
    setCantiScaletta(list)
  }

  const lancia = async (cantoId) => {
    const stop = cantoAttivo === cantoId
    const nuovoId = stop ? null : cantoId
    const { error } = await supabase.from('canto_attivo').update({
      canto_id: nuovoId, lanciato_da: profilo?.id, lanciato_at: new Date().toISOString(),
    }).eq('id', 1)
    if (error) { toast('Errore: ' + error.message, 'error'); return }
    setCantoAttivo(nuovoId)
    if (stop) toast('Canto fermato', 'default')
    else toast(`🎵 ${canti.find(x => x.id === cantoId)?.titolo || ''}`, 'success')
  }

  const canEdit = (s) => isResp || s?.autore_id === profilo?.id

  const cantiInScaletta = new Set(cantiScaletta.map(x => x.canti?.id))
  const cantiFiltrati = canti.filter(c =>
    !cantiInScaletta.has(c.id) &&
    (!cerca || c.titolo.toLowerCase().includes(cerca.toLowerCase()))
  )

  // ── Vista scaletta aperta ──
  if (scalettaAperta) {
    return (
      <div style={{ padding:16 }}>
        <ToastContainer/>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setScalettaAperta(null)}>←</button>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ margin:0, fontSize:'1.1rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{scalettaAperta.nome}</h1>
            {scalettaAperta.data && (
              <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', marginTop:2 }}>
                {new Date(scalettaAperta.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </div>
            )}
          </div>
          {canEdit(scalettaAperta) && (
            <button className="btn btn-primary btn-sm" onClick={() => setModalAggiungi(true)}>＋ Canto</button>
          )}
        </div>

        {scalettaAperta.note && (
          <div style={{ background:'var(--gray-50)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:'0.82rem', color:'var(--gray-600)', borderLeft:'3px solid var(--gray-200)' }}>
            {scalettaAperta.note}
          </div>
        )}

        {cantiScaletta.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎼</div>
            <p>Nessun canto ancora</p>
            {canEdit(scalettaAperta) && (
              <button className="btn btn-primary btn-sm" onClick={() => setModalAggiungi(true)}>Aggiungi canto</button>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {cantiScaletta.map((sc, idx) => {
              const c = sc.canti
              if (!c) return null
              const attivo = cantoAttivo === c.id
              return (
                <div key={sc.id} className="card"
                  style={{ borderLeft:`3px solid ${attivo ? 'var(--primary)' : 'var(--gray-200)'}`, background: attivo ? '#f0faf4' : '#fff' }}>
                  <div className="card-body" style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ color:'var(--gray-300)', fontWeight:800, fontSize:'0.85rem', minWidth:22, textAlign:'center', flexShrink:0 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.titolo}</div>
                        {(c.categoria || c.tonalita) && (
                          <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap' }}>
                            {c.categoria && <span className="badge badge-gray" style={{ fontSize:'0.65rem' }}>{c.categoria}</span>}
                            {c.tonalita && <span className="badge badge-blue" style={{ fontSize:'0.65rem' }}>{c.tonalita}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                        {canEdit(scalettaAperta) && (
                          <>
                            <button className="btn btn-ghost btn-sm btn-icon"
                              style={{ color: idx===0 ? 'var(--gray-200)' : 'var(--gray-500)' }}
                              onClick={() => spostaCanto(idx, -1)} disabled={idx===0}>↑</button>
                            <button className="btn btn-ghost btn-sm btn-icon"
                              style={{ color: idx===cantiScaletta.length-1 ? 'var(--gray-200)' : 'var(--gray-500)' }}
                              onClick={() => spostaCanto(idx, 1)} disabled={idx===cantiScaletta.length-1}>↓</button>
                          </>
                        )}
                        {isResp && (
                          <button className="btn btn-sm" onClick={() => lancia(c.id)}
                            style={{ background: attivo ? 'var(--red)' : 'var(--primary)', color:'#fff', fontWeight:800, minWidth:64 }}>
                            {attivo ? '⏹ Stop' : '▶ Lancia'}
                          </button>
                        )}
                        {!isResp && attivo && <span className="badge badge-green">▶ In corso</span>}
                        {canEdit(scalettaAperta) && (
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color:'var(--gray-400)' }}
                            onClick={() => rimuoviCanto(sc.id)}>✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal aggiungi canto */}
        {modalAggiungi && (
          <div className="modal-overlay" onClick={() => { setModalAggiungi(false); setCerca('') }}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-title">Aggiungi canto</div>
              <input className="form-control" placeholder="🔍 Cerca canto…" value={cerca}
                onChange={e => setCerca(e.target.value)} style={{ marginBottom:12 }} autoFocus/>
              <div style={{ maxHeight:'52vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {cantiFiltrati.length === 0 ? (
                  <p className="text-muted text-sm" style={{ textAlign:'center', padding:'24px 0' }}>
                    {cerca ? 'Nessun risultato' : 'Tutti i canti sono già in questa scaletta'}
                  </p>
                ) : cantiFiltrati.map(c => (
                  <div key={c.id} className="card" style={{ cursor:'pointer' }} onClick={() => aggiungiCanto(c.id)}>
                    <div className="card-body" style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:700, fontSize:'0.88rem' }}>{c.titolo}</div>
                      {(c.categoria || c.tonalita) && (
                        <div style={{ display:'flex', gap:4, marginTop:3 }}>
                          {c.categoria && <span className="badge badge-gray" style={{ fontSize:'0.65rem' }}>{c.categoria}</span>}
                          {c.tonalita && <span className="badge badge-blue" style={{ fontSize:'0.65rem' }}>{c.tonalita}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop:12 }}
                onClick={() => { setModalAggiungi(false); setCerca('') }}>Chiudi</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Lista scalette ──
  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🎼 Scalette</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModalNuova(true)}>＋ Nuova</button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner"/>Caricamento…</div>
      ) : scalette.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🎼</div>
          <p>Nessuna scaletta ancora</p>
          <button className="btn btn-primary btn-sm" onClick={() => setModalNuova(true)}>Crea la prima scaletta</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {scalette.map(s => (
            <div key={s.id} className="card" style={{ cursor:'pointer' }} onClick={() => apriScaletta(s)}>
              <div className="card-body" style={{ padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nome}</div>
                    {s.data && (
                      <div style={{ fontSize:'0.75rem', color:'var(--gray-500)', marginTop:2 }}>
                        {new Date(s.data + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}
                      </div>
                    )}
                    {s.note && (
                      <div style={{ fontSize:'0.73rem', color:'var(--gray-400)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.note}</div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                    {canEdit(s) && (
                      <button className="btn btn-red btn-sm btn-icon" onClick={() => eliminaScaletta(s.id)}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crea scaletta */}
      {modalNuova && (
        <div className="modal-overlay" onClick={() => setModalNuova(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Nuova scaletta</div>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-control" placeholder="es. Messa domenica 15 giugno"
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} autoFocus/>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-control" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-control" rows={3} placeholder="Note opzionali…"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}/>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={() => setModalNuova(false)}>Annulla</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={creaScaletta} disabled={saving}>
                {saving ? 'Salvataggio…' : 'Crea scaletta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
