import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'

const vuota = {
  nome: '', cognome: '', data_nascita: '', indirizzo: '',
  telefono1: '', telefono2: '', genitore: '', preferenza: '', note: '',
}

const annoCorrente = () => {
  const d = new Date()
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${String(y + 1).slice(2)}`
}

export default function Iscrizioni() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const puoGestire = ['admin', 'parroco', 'segreteria'].some(r => tuttiRuoli.includes(r))

  const [iscritti, setIscritti] = useState([])
  const [classi, setClassi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vuota)
  const [saving, setSaving] = useState(false)
  const [cerca, setCerca] = useState('')
  const [vista, setVista] = useState('da_assegnare') // da_assegnare | assegnato | confermato
  const [confermando, setConfermando] = useState(false)

  useEffect(() => { if (profilo) carica() }, [profilo])

  const carica = async () => {
    setLoading(true)
    const [{ data: isc }, { data: cl }] = await Promise.all([
      supabase.from('iscrizioni')
        .select('*, classi(nome)')
        .order('cognome', { ascending: true }),
      supabase.from('classi').select('id, nome').eq('attiva', true).order('nome'),
    ])
    setIscritti(isc || [])
    setClassi(cl || [])
    setLoading(false)
  }

  const salva = async () => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      return toast('Nome e cognome sono obbligatori', 'error')
    }
    setSaving(true)
    const dati = {
      nome: form.nome.trim(), cognome: form.cognome.trim(),
      data_nascita: form.data_nascita || null,
      indirizzo: form.indirizzo || null,
      telefono1: form.telefono1 || null, telefono2: form.telefono2 || null,
      genitore: form.genitore || null,
      preferenza: form.preferenza || null,
      note: form.note || null,
    }
    const err = modal === 'nuova'
      ? (await supabase.from('iscrizioni').insert({ ...dati, anno: annoCorrente() })).error
      : (await supabase.from('iscrizioni').update(dati).eq('id', modal.id)).error
    setSaving(false)
    if (err) return toast('Errore: ' + err.message, 'error')
    toast(modal === 'nuova' ? 'Iscrizione aggiunta' : 'Iscrizione aggiornata', 'success')
    setModal(null); carica()
  }

  // Assegna (o toglie) la classe proposta
  const assegna = async (isc, classeId) => {
    const { error } = await supabase.from('iscrizioni')
      .update({ classe_id: classeId || null, stato: classeId ? 'assegnato' : 'da_assegnare' })
      .eq('id', isc.id)
    if (error) return toast('Errore: ' + error.message, 'error')
    carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa iscrizione?')) return
    const { error } = await supabase.from('iscrizioni').delete().eq('id', id)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast('Iscrizione eliminata', 'success'); carica()
  }

  // Crea i bambini nell'anagrafica per tutti gli assegnati di una classe
  const confermaClasse = async (classe) => {
    const daFare = iscritti.filter(i => i.classe_id === classe.id && i.stato === 'assegnato')
    if (daFare.length === 0) return
    if (!window.confirm(
      `Creare ${daFare.length} bambin${daFare.length === 1 ? 'o' : 'i'} nell'anagrafica per la classe ${classe.nome}?`
    )) return

    setConfermando(true)
    let fatti = 0
    for (const i of daFare) {
      const { data: nuovo, error } = await supabase.from('bambini').insert({
        nome: i.nome, cognome: i.cognome, data_nascita: i.data_nascita,
        indirizzo: i.indirizzo, telefono1: i.telefono1, telefono2: i.telefono2,
        note: i.note, classe_id: i.classe_id, attivo: true,
      }).select('id').single()
      if (error) { toast('Errore su ' + i.cognome + ': ' + error.message, 'error'); continue }
      await supabase.from('iscrizioni')
        .update({ stato: 'confermato', bambino_id: nuovo.id }).eq('id', i.id)
      fatti++
    }
    setConfermando(false)
    toast(`${fatti} bambini creati nell'anagrafica`, 'success')
    carica()
  }

  const filtra = (lista) => lista.filter(i =>
    `${i.nome} ${i.cognome}`.toLowerCase().includes(cerca.toLowerCase()))

  const daAssegnare = filtra(iscritti.filter(i => i.stato === 'da_assegnare'))
  const assegnati = filtra(iscritti.filter(i => i.stato === 'assegnato'))
  const confermati = filtra(iscritti.filter(i => i.stato === 'confermato'))

  // Chi ha chiesto di stare con chi (per aiutare lo smistamento)
  const cercaPreferito = (pref) => {
    if (!pref) return null
    const p = pref.toLowerCase()
    return iscritti.find(i =>
      p.includes(i.nome.toLowerCase()) && p.includes(i.cognome.toLowerCase())
    ) || iscritti.find(i => p.includes(i.cognome.toLowerCase())) || null
  }

  if (!puoGestire) {
    return <div style={{ padding: 16 }}><div className="empty-state"><p>Questa sezione e' riservata a segreteria e amministrazione.</p></div></div>
  }

  const Riga = ({ i, mostraClasse }) => {
    const pref = cercaPreferito(i.preferenza)
    const prefClasse = pref?.classi?.nome
    const insieme = pref && pref.classe_id && i.classe_id && pref.classe_id === i.classe_id
    return (
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
        <div className="flex items-center justify-between" style={{ gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{i.cognome} {i.nome}</div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              {i.data_nascita ? new Date(i.data_nascita + 'T00:00:00').toLocaleDateString('it-IT') : 'data nascita mancante'}
              {i.telefono1 ? ' · ' + i.telefono1 : ''}
              {i.genitore ? ' · ' + i.genitore : ''}
            </div>

            {i.preferenza && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className={insieme ? 'ok-pill' : 'miss'}>
                  <Icon name="comunita" size={12} />
                  con {i.preferenza}
                </span>
                {pref && prefClasse && (
                  <span className="text-xs text-muted">
                    ({pref.cognome} {pref.nome} &rarr; {prefClasse})
                  </span>
                )}
                {pref && !pref.classe_id && (
                  <span className="text-xs text-muted">({pref.cognome} non ancora assegnato)</span>
                )}
              </div>
            )}

            {mostraClasse && i.classi?.nome && (
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-green">{i.classi.nome}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {i.stato !== 'confermato' && (
              <select
                className="form-control"
                style={{ width: 140, height: 38, fontSize: '0.82rem', padding: '0 10px' }}
                value={i.classe_id || ''}
                onChange={e => assegna(i, e.target.value)}
              >
                <option value="">Da assegnare</option>
                {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            <button className="btn btn-outline btn-sm btn-icon" aria-label="Modifica" onClick={() => {
              setForm({
                nome: i.nome, cognome: i.cognome, data_nascita: i.data_nascita || '',
                indirizzo: i.indirizzo || '', telefono1: i.telefono1 || '', telefono2: i.telefono2 || '',
                genitore: i.genitore || '', preferenza: i.preferenza || '', note: i.note || '',
              })
              setModal(i)
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            {i.stato !== 'confermato' && (
              <button className="btn btn-red btn-sm btn-icon" aria-label="Elimina" onClick={() => elimina(i.id)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1>Iscrizioni</h1>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>Anno {annoCorrente()}</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => { setForm(vuota); setModal('nuova') }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuova iscrizione
        </button>
      </div>

      {/* Ricerca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 11, marginBottom: 14 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input placeholder="Cerca un iscritto..." value={cerca} onChange={e => setCerca(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Nunito, sans-serif', fontSize: '0.9rem', background: 'transparent', color: 'var(--gray-900)' }} />
      </div>

      {/* Fasi */}
      <div className="chip-row" style={{ marginBottom: 16 }}>
        <button type="button" className={'chip' + (vista === 'da_assegnare' ? ' on' : '')} onClick={() => setVista('da_assegnare')}>
          Da smistare <span style={{ opacity: .7 }}>{daAssegnare.length}</span>
        </button>
        <button type="button" className={'chip' + (vista === 'assegnato' ? ' on' : '')} onClick={() => setVista('assegnato')}>
          Assegnati <span style={{ opacity: .7 }}>{assegnati.length}</span>
        </button>
        <button type="button" className={'chip' + (vista === 'confermato' ? ' on' : '')} onClick={() => setVista('confermato')}>
          In anagrafica <span style={{ opacity: .7 }}>{confermati.length}</span>
        </button>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <>
          {vista === 'da_assegnare' && (
            daAssegnare.length === 0 ? (
              <div className="empty-state">
                <Icon name="bambini" size={44} style={{ color: 'var(--gray-300)' }} />
                <p style={{ marginTop: 12 }}>Nessuno da smistare.<br />Aggiungi le nuove iscrizioni con il pulsante in alto.</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {daAssegnare.map(i => <Riga key={i.id} i={i} />)}
              </div>
            )
          )}

          {vista === 'assegnato' && (
            assegnati.length === 0 ? (
              <div className="empty-state"><p>Nessun iscritto assegnato a una classe.</p></div>
            ) : classi.map(c => {
              const membri = assegnati.filter(i => i.classe_id === c.id)
              if (membri.length === 0) return null
              return (
                <div key={c.id}>
                  <div className="grp-head" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Icon name="classi" size={18} style={{ color: 'var(--primary)' }} />
                      {c.nome}
                      <span className="n">{membri.length}</span>
                    </span>
                    <button className="btn btn-primary btn-sm" disabled={confermando} onClick={() => confermaClasse(c)}>
                      {confermando ? '...' : 'Conferma in anagrafica'}
                    </button>
                  </div>
                  <div className="card" style={{ overflow: 'hidden' }}>
                    {membri.map(i => <Riga key={i.id} i={i} />)}
                  </div>
                </div>
              )
            })
          )}

          {vista === 'confermato' && (
            confermati.length === 0 ? (
              <div className="empty-state"><p>Nessuna iscrizione ancora confermata.</p></div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {confermati.map(i => <Riga key={i.id} i={i} mostraClasse />)}
              </div>
            )
          )}
        </>
      )}

      {/* Finestra nuova/modifica */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'nuova' ? 'Nuova iscrizione' : 'Modifica iscrizione'}</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cognome *</label>
                <input className="form-control" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-control" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data di nascita</label>
                <input type="date" className="form-control" value={form.data_nascita} onChange={e => setForm(f => ({ ...f, data_nascita: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Genitore</label>
                <input className="form-control" value={form.genitore} onChange={e => setForm(f => ({ ...f, genitore: e.target.value }))} placeholder="Nome del genitore" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input className="form-control" value={form.telefono1} onChange={e => setForm(f => ({ ...f, telefono1: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Altro telefono</label>
                <input className="form-control" value={form.telefono2} onChange={e => setForm(f => ({ ...f, telefono2: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Indirizzo</label>
              <input className="form-control" value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Vorrebbe stare con</label>
              <input className="form-control" value={form.preferenza} onChange={e => setForm(f => ({ ...f, preferenza: e.target.value }))} placeholder="Es: Marco Rossi" />
              <div className="text-xs text-muted" style={{ marginTop: 5 }}>
                Scrivi nome e cognome: l&rsquo;app ti dira&rsquo; in che classe si trova, per metterli insieme.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-control" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
