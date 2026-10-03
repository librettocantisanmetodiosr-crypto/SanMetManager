import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'

const RUOLI = [
  { key: 'prima_lettura',   label: 'Prima lettura',   posti: 1 },
  { key: 'salmo',           label: 'Salmo',           posti: 1 },
  { key: 'seconda_lettura', label: 'Seconda lettura', posti: 1 },
  { key: 'offertorio',      label: 'Offertorio',      posti: 2 },
]

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
              'luglio','agosto','settembre','ottobre','novembre','dicembre']

const nomeDi = (p) => p ? `${p.nome} ${p.cognome}` : '—'

export default function Turni() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()

  const [io, setIo] = useState(null)          // il mio profilo completo
  const [anno, setAnno] = useState(new Date().getFullYear())
  const [mese, setMese] = useState(new Date().getMonth() + 1)

  const [date, setDate] = useState([])
  const [persone, setPersone] = useState([])   // tutti i catechisti
  const [classiDi, setClassiDi] = useState({}) // profilo_id -> Set(classe_id)
  const [piano, setPiano] = useState(null)
  const [turni, setTurni] = useState([])
  const [storico, setStorico] = useState({})   // profilo_id -> quante volte ha fatto
  const [passati, setPassati] = useState([])   // turni gia' assegnati: { profilo_id, ruolo, data }
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [pannello, setPannello] = useState(false)

  const isAdmin = ['admin', 'parroco'].some(r => tuttiRuoli.includes(r))
  const gestisce = isAdmin || !!io?.gestisce_turni

  useEffect(() => { if (profilo) carica() }, [profilo, anno, mese])

  const carica = async () => {
    setLoading(true)
    const primo = `${anno}-${String(mese).padStart(2, '0')}-01`
    const ultimo = new Date(anno, mese, 0).toISOString().split('T')[0]

    const [me, dt, pers, cc, pi, st] = await Promise.all([
      supabase.from('profili').select('id, partecipa_turni, gestisce_turni').eq('id', profilo.id).single(),
      supabase.from('date_catechismo').select('id, data, descrizione')
        .gte('data', primo).lte('data', ultimo).order('data'),
      supabase.from('profili').select('id, nome, cognome, ruolo, ruoli_extra, partecipa_turni, gestisce_turni')
        .eq('attivo', true).order('cognome'),
      supabase.from('classi_catechisti').select('catechista_id, classe_id'),
      supabase.from('piani_turni').select('*').eq('anno', anno).eq('mese', mese).maybeSingle(),
      supabase.from('turni').select('profilo_id, ruolo, date_catechismo(data)'),
    ])

    setIo(me.data || null)
    setDate(dt.data || [])
    setPersone((pers.data || []).filter(p =>
      p.ruolo === 'catechista' || (p.ruoli_extra || []).includes('catechista') || p.partecipa_turni))

    const mappa = {}
    ;(cc.data || []).forEach(x => {
      if (!mappa[x.catechista_id]) mappa[x.catechista_id] = new Set()
      mappa[x.catechista_id].add(x.classe_id)
    })
    setClassiDi(mappa)

    const conteggi = {}
    ;(st.data || []).forEach(t => {
      if (t.profilo_id) conteggi[t.profilo_id] = (conteggi[t.profilo_id] || 0) + 1
    })
    setStorico(conteggi)
    setPassati((st.data || [])
      .filter(t => t.profilo_id)
      .map(t => ({ profilo_id: t.profilo_id, ruolo: t.ruolo, data: t.date_catechismo?.data || null })))

    setPiano(pi.data || null)
    if (pi.data) {
      const { data: tt } = await supabase.from('turni')
        .select('id, data_id, ruolo, posizione, profilo_id')
        .eq('piano_id', pi.data.id)
      setTurni(tt || [])
    } else {
      setTurni([])
    }
    setLoading(false)
  }

  const partecipanti = persone.filter(p => p.partecipa_turni)

  // Due persone sono "della stessa classe" se condividono almeno una classe
  const stessaClasse = (a, b) => {
    const ca = classiDi[a] || new Set()
    const cb = classiDi[b] || new Set()
    for (const x of ca) if (cb.has(x)) return true
    return false
  }

  // ── Generazione del piano ────────────────────────────────────
  // Regole, dalla piu' importante:
  //  1. nessuno ha due incarichi nello stesso sabato
  //  2. chi ha servito il sabato precedente riposa (se le persone bastano)
  //  3. tocca prima a chi ha fatto meno turni in tutto, cosi' si gira
  //  4. i due dell'offertorio non sono della stessa classe
  //  5. a ognuno un incarico diverso dall'ultima volta, e quello fatto meno
  const genera = async () => {
    if (date.length === 0) return toast('Nessuna data di catechismo in questo mese', 'error')
    if (partecipanti.length < 5) {
      return toast(`Servono almeno 5 partecipanti, ne hai ${partecipanti.length}`, 'error', 6000)
    }
    setGenerando(true)

    const POSTI = RUOLI.flatMap(r =>
      Array.from({ length: r.posti }, (_, i) => ({ ruolo: r.key, posizione: i + 1 })))
    const giorniTra = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000)
    const permutazioni = (arr) => arr.length <= 1 ? [arr]
      : arr.flatMap((x, i) => permutazioni([...arr.slice(0, i), ...arr.slice(i + 1)]).map(r => [x, ...r]))

    // punto di partenza: lo storico reale, cosi' la rotazione continua da un mese all'altro
    const stato = {}
    partecipanti.forEach(p => { stato[p.id] = { tot: 0, perRuolo: {}, ultimaData: null, ultimoRuolo: null } })
    const primaData = date[0].data
    passati.forEach(t => {
      const st = stato[t.profilo_id]
      if (!st) return
      st.tot++
      st.perRuolo[t.ruolo] = (st.perRuolo[t.ruolo] || 0) + 1
      if (t.data && t.data < primaData && (!st.ultimaData || t.data > st.ultimaData)) {
        st.ultimaData = t.data
        st.ultimoRuolo = t.ruolo
      }
    })

    const nuovi = []
    let avvisi = 0        // offertorio con due della stessa classe
    let consecutivi = 0   // persone in turno due sabati di fila

    for (const d of date) {
      // ha servito il sabato prima?
      const diFila = (id) => !!stato[id].ultimaData && giorniTra(d.data, stato[id].ultimaData) <= 8

      // ordine di chiamata: prima chi ha riposato, poi chi ha fatto meno, a parita' a sorte
      const ordine = partecipanti
        .map(p => ({ p, sorte: Math.random() }))
        .sort((a, b) =>
          (diFila(a.p.id) - diFila(b.p.id)) ||
          (stato[a.p.id].tot - stato[b.p.id].tot) ||
          (a.sorte - b.sorte))
        .map(x => x.p)

      // la squadra del giorno: i primi dell'ordine
      const squadra = ordine.slice(0, POSTI.length)
      const haCoppia = (sq) => sq.some((a, i) => sq.slice(i + 1).some(b => !stessaClasse(a.id, b.id)))
      if (!haCoppia(squadra)) {
        // tutti della stessa classe: cambio l'ultimo con il primo disponibile di un'altra classe
        const sostituto = ordine.slice(POSTI.length).find(c => !stessaClasse(c.id, squadra[0].id))
        if (sostituto) squadra[squadra.length - 1] = sostituto
      }
      consecutivi += squadra.filter(p => diFila(p.id)).length

      // chi fa cosa: provo tutte le combinazioni e tengo quella con meno ripetizioni
      const costo = (p, posto) =>
        (stato[p.id].ultimoRuolo === posto.ruolo ? 10 : 0) + (stato[p.id].perRuolo[posto.ruolo] || 0) * 3
      let migliore = null
      for (const perm of permutazioni(squadra)) {
        let c = Math.random() * 0.5   // a parita' di costo, a sorte
        perm.forEach((p, i) => { c += costo(p, POSTI[i]) })
        const off = perm.filter((p, i) => POSTI[i].ruolo === 'offertorio')
        if (off.length === 2 && stessaClasse(off[0].id, off[1].id)) c += 1000
        if (!migliore || c < migliore.c) migliore = { c, perm }
      }
      if (migliore.c >= 1000) avvisi++

      migliore.perm.forEach((p, i) => {
        const posto = POSTI[i]
        const st = stato[p.id]
        st.tot++
        st.perRuolo[posto.ruolo] = (st.perRuolo[posto.ruolo] || 0) + 1
        st.ultimaData = d.data
        st.ultimoRuolo = posto.ruolo
        nuovi.push({ data_id: d.id, ruolo: posto.ruolo, posizione: posto.posizione, profilo_id: p.id })
      })
    }

    // salva piano + turni
    const { data: p, error: e1 } = await supabase.from('piani_turni')
      .insert({ anno, mese, stato: 'bozza', creato_da: profilo.id })
      .select().single()
    if (e1) { setGenerando(false); return toast('Errore: ' + e1.message, 'error', 6000) }

    const { error: e2 } = await supabase.from('turni')
      .insert(nuovi.map(t => ({ ...t, piano_id: p.id })))
    setGenerando(false)
    if (e2) return toast('Errore: ' + e2.message, 'error', 6000)

    if (avvisi > 0) {
      toast(`Piano creato, ma in ${avvisi} cas${avvisi === 1 ? 'o' : 'i'} non c'erano due persone di classi diverse`, 'error', 8000)
    } else if (consecutivi > 0) {
      toast(`Proposta creata. Con ${partecipanti.length} partecipanti qualcuno è di turno due sabati di fila: per evitarlo ne servono almeno ${POSTI.length * 2}`, 'default', 9000)
    } else {
      toast('Proposta creata', 'success')
    }
    carica()
  }

  const cambiaPersona = async (turno, nuovoId) => {
    const { data, error } = await supabase.from('turni')
      .update({ profilo_id: nuovoId || null }).eq('id', turno.id).select('id')
    if (error) return toast('Errore: ' + error.message, 'error')
    if (!data?.length) return toast('Non modificato: permessi insufficienti', 'error', 6000)
    setTurni(prev => prev.map(t => t.id === turno.id ? { ...t, profilo_id: nuovoId || null } : t))
  }

  const approva = async () => {
    const { data, error } = await supabase.from('piani_turni')
      .update({ stato: 'approvato', approvato_da: profilo.id, approvato_at: new Date().toISOString() })
      .eq('id', piano.id).select('id')
    if (error) return toast('Errore: ' + error.message, 'error')
    if (!data?.length) return toast('Non approvato: permessi insufficienti', 'error', 6000)
    toast('Piano approvato: ora lo vedono tutti', 'success')
    carica()
  }

  const riapri = async () => {
    if (!window.confirm('Rimettere il piano in bozza? Smetterà di essere visibile ai catechisti.')) return
    await supabase.from('piani_turni').update({ stato: 'bozza' }).eq('id', piano.id)
    carica()
  }

  const eliminaPiano = async () => {
    if (!window.confirm('Eliminare il piano di questo mese e tutti i suoi turni?')) return
    const { error } = await supabase.from('piani_turni').delete().eq('id', piano.id)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast('Piano eliminato', 'success'); carica()
  }

  const togglePersona = async (p, campo) => {
    const { data, error } = await supabase.from('profili')
      .update({ [campo]: !p[campo] }).eq('id', p.id).select('id')
    if (error) return toast('Errore: ' + error.message, 'error')
    if (!data?.length) return toast('Non modificato: permessi insufficienti', 'error', 6000)
    setPersone(prev => prev.map(x => x.id === p.id ? { ...x, [campo]: !p[campo] } : x))
  }

  // ── Testo per WhatsApp ───────────────────────────────────────
  const testoWhatsApp = () => {
    const righe = [`*TURNI LITURGICI — ${MESI[mese - 1]} ${anno}*`, '']
    date.forEach(d => {
      const g = new Date(d.data + 'T00:00:00')
      righe.push(`*Sabato ${g.getDate()} ${MESI[g.getMonth()]}*`)
      RUOLI.forEach(r => {
        if (r.key === 'offertorio') {
          const due = [1, 2].map(pos => {
            const t = turni.find(x => x.data_id === d.id && x.ruolo === 'offertorio' && x.posizione === pos)
            return nomeDi(persone.find(p => p.id === t?.profilo_id))
          }).filter(n => n !== '—')
          righe.push(`Offertorio: ${due.join(' e ') || '—'}`)
        } else {
          const t = turni.find(x => x.data_id === d.id && x.ruolo === r.key)
          righe.push(`${r.label}: ${nomeDi(persone.find(p => p.id === t?.profilo_id))}`)
        }
      })
      righe.push('')
    })
    righe.push('Grazie a tutti!')
    return righe.join('\n')
  }

  const copia = async () => {
    const testo = testoWhatsApp()
    try {
      await navigator.clipboard.writeText(testo)
      toast('Copiato: incollalo nel gruppo WhatsApp', 'success')
    } catch {
      window.prompt('Copia il testo qui sotto:', testo)
    }
  }

  const turnoDi = (dataId, ruolo, pos) =>
    turni.find(t => t.data_id === dataId && t.ruolo === ruolo && (t.posizione || 1) === pos)

  const meseIndietro = () => {
    if (mese === 1) { setMese(12); setAnno(anno - 1) } else setMese(mese - 1)
  }
  const meseAvanti = () => {
    if (mese === 12) { setMese(1); setAnno(anno + 1) } else setMese(mese + 1)
  }

  // ── Vista ────────────────────────────────────────────────────
  const mioTurni = turni.filter(t => t.profilo_id === profilo?.id)
  const pianoVisibile = piano && (piano.stato === 'approvato' || gestisce)

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ToastContainer />

      <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Turni liturgici</h1>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            Letture e offertorio del sabato
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 3 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={meseIndietro} aria-label="Mese precedente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span style={{ fontSize: '0.86rem', fontWeight: 800, padding: '0 10px', whiteSpace: 'nowrap' }}>
              {MESI[mese - 1]} {anno}
            </span>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={meseAvanti} aria-label="Mese successivo">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          {gestisce && (
            <button className="btn btn-outline btn-sm" onClick={() => setPannello(!pannello)} style={{ gap: 6 }}>
              <Icon name="coristi" size={15} /> Partecipanti
            </button>
          )}
        </div>
      </div>

      {/* Il mio turno — lo vede chiunque */}
      {piano?.stato === 'approvato' && mioTurni.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--primary-bg)', border: 'none' }}>
          <div className="card-body">
            <div className="dash-label" style={{ color: 'var(--primary)' }}>I tuoi turni questo mese</div>
            {mioTurni.map(t => {
              const d = date.find(x => x.id === t.data_id)
              const r = RUOLI.find(x => x.key === t.ruolo)
              if (!d) return null
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7 }}>
                  <Icon name="date" size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-sm">
                    <strong>Sabato {new Date(d.data + 'T00:00:00').getDate()}</strong> — {r?.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pannello partecipanti */}
      {gestisce && pannello && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="dash-label">Chi partecipa ai turni</div>
            <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
              Spunta chi entra nella rotazione. &ldquo;Gestisce&rdquo; pu&ograve; generare, modificare e approvare i piani.
            </p>
            {persone.map(p => (
              <div key={p.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  {p.cognome} {p.nome}
                  {storico[p.id] ? <span className="text-xs text-muted"> · {storico[p.id]} turni finora</span> : null}
                </span>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!p.partecipa_turni} onChange={() => togglePersona(p, 'partecipa_turni')}
                      style={{ width: 17, height: 17, accentColor: 'var(--primary)' }} />
                    partecipa
                  </label>
                  {isAdmin && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!p.gestisce_turni} onChange={() => togglePersona(p, 'gestisce_turni')}
                        style={{ width: 17, height: 17, accentColor: 'var(--primary)' }} />
                      gestisce
                    </label>
                  )}
                </div>
              </div>
            ))}
            <div className="text-sm" style={{ marginTop: 12, fontWeight: 700 }}>
              {partecipanti.length} partecipant{partecipanti.length === 1 ? 'e' : 'i'} in rotazione
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <>
          {date.length === 0 ? (
            <div className="empty-state">
              <Icon name="date" size={44} style={{ color: 'var(--gray-300)' }} />
              <p style={{ marginTop: 12 }}>
                Nessuna data di catechismo in {MESI[mese - 1]}.<br />
                Aggiungile in Catechismo &rarr; Date.
              </p>
            </div>
          ) : !piano ? (
            <div className="empty-state">
              <Icon name="supplenze" size={44} style={{ color: 'var(--gray-300)' }} />
              <p style={{ marginTop: 12 }}>
                Non c&rsquo;&egrave; ancora un piano per {MESI[mese - 1]}.
              </p>
              {gestisce && (
                <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={genera} disabled={generando}>
                  {generando ? 'Genero...' : 'Genera proposta'}
                </button>
              )}
            </div>
          ) : !pianoVisibile ? (
            <div className="empty-state">
              <p>Il piano di {MESI[mese - 1]} &egrave; in preparazione.<br />Lo vedrai appena sar&agrave; approvato.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4" style={{ gap: 10, flexWrap: 'wrap' }}>
                <span className={'badge ' + (piano.stato === 'approvato' ? 'badge-green' : 'badge-gold')}>
                  {piano.stato === 'approvato' ? 'Approvato' : 'Bozza da approvare'}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={copia} style={{ gap: 6 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Copia per WhatsApp
                  </button>
                  {gestisce && piano.stato === 'bozza' && (
                    <button className="btn btn-primary btn-sm" onClick={approva}>Approva</button>
                  )}
                  {gestisce && piano.stato === 'approvato' && (
                    <button className="btn btn-outline btn-sm" onClick={riapri}>Rimetti in bozza</button>
                  )}
                  {gestisce && (
                    <button className="btn btn-red btn-sm" onClick={eliminaPiano}>Elimina piano</button>
                  )}
                </div>
              </div>

              {date.map(d => {
                const g = new Date(d.data + 'T00:00:00')
                return (
                  <div key={d.id} style={{ marginBottom: 16 }}>
                    <div className="grp-head">
                      <Icon name="date" size={17} style={{ color: 'var(--primary)' }} />
                      Sabato {g.getDate()} {MESI[g.getMonth()]}
                      {d.descrizione && <span className="n">{d.descrizione}</span>}
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      {RUOLI.map(r => (
                        [...Array(r.posti)].map((_, i) => {
                          const pos = i + 1
                          const t = turnoDi(d.id, r.key, pos)
                          const pers = persone.find(p => p.id === t?.profilo_id)
                          return (
                            <div key={r.key + pos} className="flex items-center justify-between"
                              style={{ padding: '11px 15px', borderBottom: '1px solid var(--gray-100)', gap: 10 }}>
                              <span style={{ fontSize: '0.86rem', fontWeight: 700, minWidth: 130 }}>
                                {r.label}{r.posti > 1 ? ` ${pos}` : ''}
                              </span>
                              {gestisce && t ? (
                                <select
                                  className="form-control"
                                  style={{ height: 38, fontSize: '0.84rem', padding: '0 10px', maxWidth: 220 }}
                                  value={t.profilo_id || ''}
                                  onChange={e => cambiaPersona(t, e.target.value)}
                                >
                                  <option value="">— nessuno —</option>
                                  {partecipanti.map(p => (
                                    <option key={p.id} value={p.id}>{p.cognome} {p.nome}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm" style={{ fontWeight: 600 }}>{nomeDi(pers)}</span>
                              )}
                            </div>
                          )
                        })
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}
