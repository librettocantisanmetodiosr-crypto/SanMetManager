import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

export default function Canti() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isResponsabile = ['admin', 'parroco', 'responsabile_coro'].includes(profilo?.ruolo)

  const [canti, setCanti] = useState([])
  const [cantoAttivo, setCantoAttivo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [vistaModal, setVistaModal] = useState(null)
  const [cerca, setCerca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [form, setForm] = useState({ titolo: '', categoria: '', tonalita: '', testo: '', accordi: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(null) // id del canto in upload
  const pdfInputRef = useRef(null)
  const pdfTargetRef = useRef(null) // id canto a cui caricare il pdf

  // Refs per evitare stale closure nel listener realtime
  const cantiRef = useRef([])
  const isResponsabileRef = useRef(false)
  useEffect(() => { cantiRef.current = canti }, [canti])
  useEffect(() => { isResponsabileRef.current = isResponsabile }, [isResponsabile])

  useEffect(() => {
    caricaCanti()
    caricaCantoAttivo()

    const ch = supabase
      .channel('canto_attivo')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'canto_attivo' }, payload => {
        setCantoAttivo(payload.new.canto_id)
        if (payload.new.canto_id && !isResponsabileRef.current) {
          const canto = cantiRef.current.find(c => c.id === payload.new.canto_id)
          if (canto) setVistaModal(canto)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  const caricaCanti = async () => {
    const { data } = await supabase.from('canti').select('*').order('categoria').order('titolo')
    setCanti(data || [])
    setLoading(false)
  }

  const caricaCantoAttivo = async () => {
    const { data } = await supabase.from('canto_attivo').select('canto_id').single()
    setCantoAttivo(data?.canto_id)
  }

  const lancia = async (cantoId) => {
    if (cantoAttivo === cantoId) {
      await supabase.from('canto_attivo').update({ canto_id: null, lanciato_da: profilo?.id, lanciato_at: new Date().toISOString() }).eq('id', 1)
      setCantoAttivo(null)
      toast('Canto fermato', 'default')
    } else {
      await supabase.from('canto_attivo').update({ canto_id: cantoId, lanciato_da: profilo?.id, lanciato_at: new Date().toISOString() }).eq('id', 1)
      setCantoAttivo(cantoId)
      const canto = canti.find(c => c.id === cantoId)
      toast(`🎵 Lanciato: ${canto?.titolo}`, 'success')
    }
  }

  const salva = async () => {
    if (!form.titolo.trim()) return toast('Inserisci il titolo', 'error')
    setSaving(true)
    if (modal === 'nuovo') {
      const { data, error } = await supabase.from('canti').insert({ ...form, autore_id: profilo?.id }).select().single()
      if (error) toast('Errore nel salvataggio', 'error')
      else { toast('Canto aggiunto ✓', 'success'); caricaCanti() }
    } else {
      const { error } = await supabase.from('canti').update(form).eq('id', modal.id)
      if (error) toast('Errore nel salvataggio', 'error')
      else { toast('Canto aggiornato ✓', 'success'); caricaCanti() }
    }
    setSaving(false)
    setModal(null)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo canto?')) return
    await supabase.from('canti').delete().eq('id', id)
    toast('Canto eliminato', 'success')
    caricaCanti()
  }

  /* ── Gestione PDF ──────────────────────────────────────────── */
  const avviaUploadPdf = (cantoId) => {
    pdfTargetRef.current = cantoId
    pdfInputRef.current?.click()
  }

  const onPdfSelezionato = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const cantoId = pdfTargetRef.current
    if (!cantoId) return
    if (file.type !== 'application/pdf') return toast('Seleziona un file PDF', 'error')
    if (file.size > 20 * 1024 * 1024) return toast('File troppo grande (max 20 MB)', 'error')

    setUploadingPdf(cantoId)
    try {
      const path = `${cantoId}.pdf`
      const { error: upErr } = await supabase.storage
        .from('canti-pdf')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (upErr) {
        if (upErr.message.includes('Bucket not found')) throw new Error('Bucket "canti-pdf" non trovato — crealo in Supabase → Storage')
        throw upErr
      }
      const { data: urlData } = supabase.storage.from('canti-pdf').getPublicUrl(path)
      const { error: updErr } = await supabase.from('canti').update({ pdf_url: urlData.publicUrl }).eq('id', cantoId)
      if (updErr) throw updErr
      toast('PDF caricato ✓', 'success')
      caricaCanti()
    } catch (err) {
      toast('Errore upload: ' + (err.message || ''), 'error')
    }
    setUploadingPdf(null)
    e.target.value = ''
  }

  const rimuoviPdf = async (cantoId, pdfUrl) => {
    if (!window.confirm('Rimuovere il PDF da questo canto?')) return
    // Rimuove da storage
    const path = `${cantoId}.pdf`
    await supabase.storage.from('canti-pdf').remove([path])
    // Azzera l'url nel DB
    await supabase.from('canti').update({ pdf_url: null }).eq('id', cantoId)
    toast('PDF rimosso', 'success')
    caricaCanti()
  }

  /* ── Formattazione testo con accordi ───────────────────────── */
  const formattaTesto = (testo) => {
    if (!testo) return null
    return testo.split('\n').map((riga, i) => (
      <div key={i} style={{ marginBottom: 2 }}>
        {riga.split(/(\[[^\]]+\])/g).map((parte, j) =>
          parte.startsWith('[') ? (
            <span key={j} style={{ color: 'var(--blue)', fontWeight: 800, fontSize: '0.85rem' }}>
              {parte.slice(1, -1)}
            </span>
          ) : (
            <span key={j}>{parte}</span>
          )
        )}
      </div>
    ))
  }

  const categorie = [...new Set(canti.map(c => c.categoria).filter(Boolean))]
  const cantiFiltrati = canti.filter(c => {
    const ok = c.titolo.toLowerCase().includes(cerca.toLowerCase())
    const okCat = !filtroCategoria || c.categoria === filtroCategoria
    return ok && okCat
  })

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />

      {/* Input file PDF nascosto */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={onPdfSelezionato}
      />

      <div className="flex items-center justify-between mb-4">
        <h1>🎵 Canti</h1>
        {isResponsabile && (
          <button className="btn btn-primary btn-sm"
            onClick={() => { setForm({ titolo: '', categoria: '', tonalita: '', testo: '', accordi: '' }); setModal('nuovo') }}>
            ＋ Aggiungi
          </button>
        )}
      </div>

      {/* Canto attivo banner */}
      {cantoAttivo && (
        <div style={{ background: 'var(--primary)', color: '#fff', padding: '12px 16px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem', animation: 'spin 2s linear infinite' }}>🎵</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>In corso: {canti.find(c => c.id === cantoAttivo)?.titolo}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Tap per aprire</div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            onClick={() => setVistaModal(canti.find(c => c.id === cantoAttivo))}
          >Apri</button>
        </div>
      )}

      {/* Cerca e filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="form-control" placeholder="🔍 Cerca canto…" value={cerca}
          onChange={e => setCerca(e.target.value)} style={{ flex: 1 }} />
        <select className="form-control" value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)} style={{ width: 130 }}>
          <option value="">Tutte</option>
          {categorie.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" />Caricamento…</div>
      ) : cantiFiltrati.length === 0 ? (
        <div className="empty-state"><div className="icon">🎶</div><p>Nessun canto trovato</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cantiFiltrati.map(c => (
            <div key={c.id} className="card" style={{ borderLeft: cantoAttivo === c.id ? '4px solid var(--primary)' : '' }}>
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div className="flex items-center justify-between">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setVistaModal(c)}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{c.titolo}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {c.categoria && <span className="badge badge-green">{c.categoria}</span>}
                      {c.tonalita && <span>{c.tonalita}</span>}
                      {c.pdf_url && <span className="badge badge-blue">📄 PDF</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {/* Apri PDF */}
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer">
                        <button className="btn btn-outline btn-sm btn-icon" title="Apri PDF">📄</button>
                      </a>
                    )}
                    {isResponsabile && (
                      <>
                        {/* Upload PDF */}
                        <button
                          className="btn btn-outline btn-sm btn-icon"
                          title={c.pdf_url ? 'Sostituisci PDF' : 'Carica PDF scansionato'}
                          disabled={uploadingPdf === c.id}
                          onClick={() => avviaUploadPdf(c.id)}
                        >
                          {uploadingPdf === c.id ? <div className="spinner" style={{ width: 14, height: 14 }} /> : '⬆'}
                        </button>
                        {/* Rimuovi PDF */}
                        {c.pdf_url && (
                          <button className="btn btn-outline btn-sm btn-icon" title="Rimuovi PDF"
                            onClick={() => rimuoviPdf(c.id, c.pdf_url)}>✕</button>
                        )}
                        {/* Lancia */}
                        <button
                          className="btn btn-sm"
                          style={{ background: cantoAttivo === c.id ? 'var(--red)' : 'var(--primary)', color: '#fff', fontWeight: 800, minWidth: 70 }}
                          onClick={() => lancia(c.id)}
                        >
                          {cantoAttivo === c.id ? '⏹ Stop' : '▶ Lancia'}
                        </button>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => {
                          setForm({ titolo: c.titolo, categoria: c.categoria || '', tonalita: c.tonalita || '', testo: c.testo || '', accordi: c.accordi || '' })
                          setModal(c)
                        }}>✏️</button>
                        <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(c.id)}>🗑</button>
                      </>
                    )}
                    {/* Coristi: solo lancia (read-only) */}
                    {!isResponsabile && cantoAttivo === c.id && (
                      <span className="badge badge-green">▶ In corso</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: VISTA CANTO ──────────────────────────────── */}
      {vistaModal && (
        <div className="modal-overlay" onClick={() => setVistaModal(null)}>
          <div className="modal" style={{ borderRadius: '20px 20px 0 0', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2>{vistaModal.titolo}</h2>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {vistaModal.categoria && <span className="badge badge-green">{vistaModal.categoria}</span>}
                  {vistaModal.tonalita && <span className="badge badge-blue">{vistaModal.tonalita}</span>}
                  {vistaModal.pdf_url && (
                    <a href={vistaModal.pdf_url} target="_blank" rel="noreferrer">
                      <span className="badge badge-gray" style={{ cursor: 'pointer' }}>📄 Apri PDF</span>
                    </a>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setVistaModal(null)}>✕</button>
            </div>
            {vistaModal.testo ? (
              <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {formattaTesto(vistaModal.testo)}
              </div>
            ) : vistaModal.pdf_url ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Testo non disponibile — visualizza il PDF</p>
                <a href={vistaModal.pdf_url} target="_blank" rel="noreferrer">
                  <button className="btn btn-primary">📄 Apri PDF scansionato</button>
                </a>
              </div>
            ) : (
              <p className="text-muted text-sm">Nessun testo o PDF inserito per questo canto.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: AGGIUNGI / MODIFICA ──────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuovo' ? 'Nuovo Canto' : 'Modifica Canto'}</div>
            <div className="form-group">
              <label className="form-label">Titolo *</label>
              <input className="form-control" value={form.titolo}
                onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <input className="form-control" value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Es: Offertorio" />
              </div>
              <div className="form-group">
                <label className="form-label">Tonalità</label>
                <input className="form-control" value={form.tonalita}
                  onChange={e => setForm(f => ({ ...f, tonalita: e.target.value }))} placeholder="Es: Sol maggiore" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Testo (usa [Accordo] per gli accordi)</label>
              <textarea className="form-control" rows={6} value={form.testo}
                onChange={e => setForm(f => ({ ...f, testo: e.target.value }))}
                placeholder="[Sol]Tu sei la mia vi[Re]ta..." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
