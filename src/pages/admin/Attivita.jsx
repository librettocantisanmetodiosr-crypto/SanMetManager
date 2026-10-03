import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'

// Pagina di controllo dell'amministratore: chi è collegato adesso, quando è
// entrato ciascuno l'ultima volta e il registro di tutte le modifiche.
// Il registro lo scrive il database (vedi src/lib/migrazione_registro.sql).

const PASSO = 300              // righe caricate per volta
const SOGLIA_ONLINE = 150000   // collegato = segnale negli ultimi 2 minuti e mezzo
const RAFFICA = 180000         // modifiche uguali entro 3 minuti stanno in una riga sola

// tabella -> [singolare con articolo, plurale]
const TABELLE = {
  bambini:             ['un bambino', 'bambini'],
  presenze:            ['una presenza', 'presenze'],
  classi:              ['una classe', 'classi'],
  classi_catechisti:   ['un catechista di classe', 'catechisti di classe'],
  date_catechismo:     ['una data', 'date'],
  attivita_classe:     ['una pagina di diario', 'pagine di diario'],
  note_giornata:       ['una nota di giornata', 'note di giornata'],
  iscrizioni:          ["un'iscrizione", 'iscrizioni'],
  supplenze:           ['una supplenza', 'supplenze'],
  bacheca:             ['un avviso in bacheca', 'avvisi in bacheca'],
  piani_turni:         ['un piano dei turni', 'piani dei turni'],
  turni:               ['un turno', 'turni'],
  profili:             ['un utente', 'utenti'],
  eventi_calendario:   ['un evento', 'eventi'],
  lettere:             ['una lettera', 'lettere'],
  rubrica:             ['un contatto', 'contatti'],
  canti:               ['un canto', 'canti'],
  scalette:            ['una scaletta', 'scalette'],
  scalette_canti:      ['un canto in scaletta', 'canti in scaletta'],
  presenze_coro:       ['una presenza del coro', 'presenze del coro'],
  archivio_file:       ['un file in archivio', 'file in archivio'],
  comunita_neo:        ['una comunità', 'comunità'],
  membri_neo:          ['un membro di comunità', 'membri di comunità'],
  stanze:              ['una stanza', 'stanze'],
  prenotazioni_stanze: ['una prenotazione', 'prenotazioni'],
  avvisi_neo:          ['un avviso neocatecumenale', 'avvisi neocatecumenali'],
}

const TIPI = {
  INSERT: { verbo: 'ha aggiunto',   etichetta: 'Aggiunte',     icon: 'piu',      color: 'var(--primary)', bg: 'var(--primary-bg)' },
  UPDATE: { verbo: 'ha modificato', etichetta: 'Modifiche',    icon: 'modifica', color: '#4c6478',        bg: 'var(--blue-bg)' },
  DELETE: { verbo: 'ha eliminato',  etichetta: 'Eliminazioni', icon: 'elimina',  color: '#8f5641',        bg: 'var(--red-bg)' },
  LOGIN:  { verbo: 'è entrato',     etichetta: 'Accessi',      icon: 'utenti',   color: 'var(--gray-700)', bg: 'var(--gray-100)' },
  LOGOUT: { verbo: 'è uscito',      etichetta: 'Accessi',      icon: 'esci',     color: 'var(--gray-500)', bg: 'var(--gray-100)' },
}

// vecchio registro scritto dalle pagine, prima che lo tenesse il database
const VECCHIE_AZIONI = {
  NUOVO_BAMBINO:    ['INSERT', 'bambini'],
  MODIFICA_BAMBINO: ['UPDATE', 'bambini'],
  ELIMINA_BAMBINO:  ['DELETE', 'bambini'],
  NUOVA_CLASSE:     ['INSERT', 'classi'],
  MODIFICA_CLASSE:  ['UPDATE', 'classi'],
  NUOVO_UTENTE:     ['INSERT', 'profili'],
  MODIFICA_UTENTE:  ['UPDATE', 'profili'],
  DISATTIVA_UTENTE: ['DELETE', 'profili'],
}

const PERIODI = [
  { id: 'oggi', label: 'Oggi', giorni: 1 },
  { id: '7',    label: '7 giorni', giorni: 7 },
  { id: '30',   label: '30 giorni', giorni: 30 },
  { id: 'tutto', label: 'Tutto', giorni: null },
]

const ora = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

const giornoEsteso = (d) => {
  const oggi = new Date()
  const ieri = new Date(); ieri.setDate(oggi.getDate() - 1)
  if (d.toDateString() === oggi.toDateString()) return 'Oggi'
  if (d.toDateString() === ieri.toDateString()) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

const tempoFa = (d) => {
  if (!d) return 'mai'
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 60) return 'adesso'
  if (s < 3600) return `${Math.floor(s / 60)} min fa`
  if (s < 86400 && d.toDateString() === new Date().toDateString()) return `oggi alle ${ora(d)}`
  const g = giornoEsteso(d)
  return `${g === 'Ieri' ? 'ieri' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${ora(d)}`
}

export default function Attivita() {
  const [scheda, setScheda] = useState('adesso')
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState(false)
  const [limite, setLimite] = useState(PASSO)
  const [aggiornato, setAggiornato] = useState(null)

  const [utenti, setUtenti] = useState([])
  const [nomi, setNomi] = useState({})          // id -> nome leggibile (persone, classi, bambini)
  const [presenza, setPresenza] = useState({})  // utente_id -> { ultimo_segnale, pagina, dispositivo }
  const [ultimoLogin, setUltimoLogin] = useState({})
  const [righe, setRighe] = useState([])
  const [altro, setAltro] = useState(false)     // ci sono righe più vecchie da caricare

  const [fUtente, setFUtente] = useState('')
  const [fTabella, setFTabella] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fPeriodo, setFPeriodo] = useState('7')
  const [cerca, setCerca] = useState('')
  const [aperte, setAperte] = useState({})

  const limiteRef = useRef(limite)
  limiteRef.current = limite

  useEffect(() => { carica(true) }, [limite])

  // si aggiorna da sola ogni 30 secondi, finché la pagina è in primo piano
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') carica(false) }, 30000)
    return () => clearInterval(t)
  }, [])

  const carica = async (conRotella) => {
    if (conRotella) setLoading(true)
    const lim = limiteRef.current
    const [pr, pu, reg, log, cl, bm, ll] = await Promise.all([
      supabase.from('profili').select('id, nome, cognome, username, ruolo, attivo').order('cognome'),
      supabase.from('presenza_utenti').select('utente_id, ultimo_segnale, pagina, dispositivo'),
      supabase.from('registro_modifiche')
        .select('id, created_at, utente_id, tabella, operazione, record_id, descrizione, modifiche')
        .order('created_at', { ascending: false }).limit(lim),
      supabase.from('log_attivita').select('id, azione, dettaglio, created_at, utente_id')
        .order('created_at', { ascending: false }).limit(lim),
      supabase.from('classi').select('id, nome'),
      supabase.from('bambini').select('id, nome, cognome'),
      supabase.rpc('get_users_last_login'),
    ])

    if (reg.error || pu.error) { setErrore(true); setLoading(false); return }
    setErrore(false)

    const mappa = {}
    ;(pr.data || []).forEach(p => { mappa[p.id] = `${p.nome} ${p.cognome}` })
    ;(cl.data || []).forEach(c => { mappa[c.id] = c.nome })
    ;(bm.data || []).forEach(b => { mappa[b.id] = `${b.cognome} ${b.nome}` })
    setNomi(mappa)
    setUtenti(pr.data || [])

    const pres = {}
    ;(pu.data || []).forEach(p => { pres[p.utente_id] = p })
    setPresenza(pres)

    const login = {}
    if (!ll.error) (ll.data || []).forEach(r => { login[r.profilo_id] = r.last_sign_in })
    setUltimoLogin(login)

    // un elenco solo: modifiche registrate dal database + accessi
    const daRegistro = (reg.data || []).map(r => ({
      chiave: `r${r.id}`, quando: new Date(r.created_at), utente_id: r.utente_id,
      tipo: r.operazione, tabella: r.tabella, descrizione: r.descrizione, modifiche: r.modifiche,
    }))
    const daLog = (log.data || []).map(r => {
      const vecchia = VECCHIE_AZIONI[r.azione]
      return {
        chiave: `l${r.id}`, quando: new Date(r.created_at), utente_id: r.utente_id,
        tipo: vecchia ? vecchia[0] : r.azione, tabella: vecchia ? vecchia[1] : null,
        descrizione: r.dettaglio, modifiche: null,
      }
    }).filter(r => TIPI[r.tipo])

    // se una delle due fonti è stata troncata, taglio l'altra allo stesso punto
    const pieno = (arr) => arr.length >= lim ? arr[arr.length - 1].quando.getTime() : 0
    const soglia = Math.max(pieno(daRegistro), pieno(daLog))
    setAltro(soglia > 0)
    setRighe([...daRegistro, ...daLog]
      .filter(r => r.quando.getTime() >= soglia)
      .sort((a, b) => b.quando - a.quando))

    setAggiornato(new Date())
    setLoading(false)
  }

  const nomeUtente = (id) => id ? (nomi[id] || 'Utente rimosso') : 'Dal pannello del database'

  // ── Chi è collegato ──────────────────────────────────────────
  const persone = useMemo(() => {
    const adesso = Date.now()
    return utenti.filter(u => u.attivo !== false).map(u => {
      const p = presenza[u.id]
      const segnale = p?.ultimo_segnale ? new Date(p.ultimo_segnale) : null
      const login = ultimoLogin[u.id] ? new Date(ultimoLogin[u.id]) : null
      const visto = segnale && login ? (segnale > login ? segnale : login) : (segnale || login)
      const online = !!segnale && adesso - segnale.getTime() < SOGLIA_ONLINE && p.pagina !== 'USCITO'
      const ultima = righe.find(r => r.utente_id === u.id && r.tipo !== 'LOGIN' && r.tipo !== 'LOGOUT')
      return { ...u, online, visto, pagina: p?.pagina, dispositivo: p?.dispositivo, ultima }
    }).sort((a, b) => (b.online - a.online) || ((b.visto?.getTime() || 0) - (a.visto?.getTime() || 0)))
  }, [utenti, presenza, ultimoLogin, righe, aggiornato])

  const collegati = persone.filter(p => p.online)
  const scollegati = persone.filter(p => !p.online)
  const entratiOggi = persone.filter(p => p.visto && p.visto.toDateString() === new Date().toDateString()).length

  // ── Registro ─────────────────────────────────────────────────
  const frase = (r, quanti = 1) => {
    const t = TIPI[r.tipo]
    if (r.tipo === 'LOGIN' || r.tipo === 'LOGOUT') return t.verbo
    const [uno, molti] = TABELLE[r.tabella] || [`una riga di ${r.tabella}`, `righe di ${r.tabella}`]
    let verbo = t.verbo
    const attivo = r.modifiche?.attivo
    if (r.tipo === 'UPDATE' && Array.isArray(attivo) && Object.keys(r.modifiche).length === 1) {
      verbo = attivo[1] === false ? 'ha rimosso' : 'ha riattivato'
    }
    return quanti > 1 ? `${verbo} ${quanti} ${molti}` : `${verbo} ${uno}`
  }

  const filtrate = useMemo(() => {
    const periodo = PERIODI.find(p => p.id === fPeriodo)
    let da = 0
    if (periodo?.giorni) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (periodo.giorni - 1))
      da = d.getTime()
    }
    const q = cerca.trim().toLowerCase()
    return righe.filter(r => {
      if (da && r.quando.getTime() < da) return false
      if (fUtente && (fUtente === 'database' ? r.utente_id !== null : r.utente_id !== fUtente)) return false
      if (fTabella && r.tabella !== fTabella) return false
      if (fTipo === 'ACCESSI' ? !['LOGIN', 'LOGOUT'].includes(r.tipo) : fTipo && r.tipo !== fTipo) return false
      if (q && !`${nomeUtente(r.utente_id)} ${r.descrizione || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [righe, fUtente, fTabella, fTipo, fPeriodo, cerca, nomi])

  // modifiche uguali, della stessa persona, a pochi minuti: una riga sola (es. le presenze di una classe)
  const gruppi = useMemo(() => {
    const out = []
    filtrate.forEach(r => {
      const ult = out[out.length - 1]
      const raggruppabile = r.tabella && ['INSERT', 'UPDATE', 'DELETE'].includes(r.tipo)
      if (ult && raggruppabile && ult.righe[0].utente_id === r.utente_id && ult.righe[0].tabella === r.tabella
          && ult.righe[0].tipo === r.tipo && ult.righe[ult.righe.length - 1].quando - r.quando < RAFFICA) {
        ult.righe.push(r)
      } else {
        out.push({ chiave: r.chiave, righe: [r] })
      }
    })
    return out
  }, [filtrate])

  const tabellePresenti = useMemo(
    () => [...new Set(righe.map(r => r.tabella).filter(Boolean))]
      .sort((a, b) => (TABELLE[a]?.[1] || a).localeCompare(TABELLE[b]?.[1] || b)),
    [righe])

  const valore = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    if (typeof v === 'boolean') return v ? 'sì' : 'no'
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
    if (typeof v === 'object') return JSON.stringify(v)
    if (typeof v === 'string') {
      if (nomi[v]) return nomi[v]
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00').toLocaleDateString('it-IT')
    }
    return String(v)
  }
  const campo = (k) => k.replace(/_id$/, '').replace(/_/g, ' ')

  const Dettaglio = ({ r }) => {
    if (!r.modifiche) return null
    const voci = Object.entries(r.modifiche)
      .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
    if (voci.length === 0) return null
    return (
      <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--gray-50)', borderRadius: 8, fontSize: '0.8rem', lineHeight: 1.7 }}>
        {r.tipo === 'DELETE' && <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Dati al momento dell'eliminazione</div>}
        {voci.map(([k, v]) => (
          <div key={k} style={{ wordBreak: 'break-word' }}>
            <span style={{ color: 'var(--gray-500)' }}>{campo(k)}: </span>
            {r.tipo === 'UPDATE' && Array.isArray(v)
              ? <><span style={{ textDecoration: 'line-through', color: 'var(--gray-500)' }}>{valore(v[0])}</span> → <b>{valore(v[1])}</b></>
              : <b>{valore(v)}</b>}
          </div>
        ))}
      </div>
    )
  }

  const pulsanteScheda = (id, label, n) => (
    <button type="button" className={`chip ${scheda === id ? 'on' : ''}`} onClick={() => setScheda(id)}>
      {label}{n !== undefined && <span style={{ opacity: 0.75, fontWeight: 600 }}>{n}</span>}
    </button>
  )

  let giornoCorrente = null

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="attivita" size={22} /> Controllo</h1>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            Chi è collegato e chi ha fatto cosa{aggiornato ? ` · aggiornato alle ${ora(aggiornato)}` : ''}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => carica(false)} style={{ gap: 6 }}>
          <Icon name="aggiorna" size={15} /> Aggiorna
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {pulsanteScheda('adesso', 'Adesso', collegati.length)}
        {pulsanteScheda('registro', 'Registro modifiche')}
      </div>

      {errore && (
        <div style={{ background: 'var(--red-bg)', color: '#8f5641', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: '0.85rem', lineHeight: 1.6 }}>
          <b>Registro non disponibile.</b> Il database non ha risposto oppure non hai i permessi di amministratore.
        </div>
      )}

      {loading ? <div className="loader"><div className="spinner" /></div> : scheda === 'adesso' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            <Numero n={collegati.length} label="Collegati ora" color="var(--primary)" bg="var(--primary-bg)" />
            <Numero n={entratiOggi} label="Entrati oggi" color="#4c6478" bg="var(--blue-bg)" />
            <Numero n={persone.filter(p => !p.visto).length} label="Mai entrati" color="#8f5641" bg="var(--red-bg)" />
          </div>

          <div className="dash-label">Collegati adesso</div>
          {collegati.length === 0 ? (
            <div className="card" style={{ marginBottom: 18 }}><div className="card-body text-sm text-muted">Nessuno è collegato in questo momento.</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {collegati.map(p => (
                <div key={p.id} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.nome} {p.cognome}</span>
                      <span className="badge badge-gray">{p.ruolo}</span>
                      {p.dispositivo && <span className="text-xs text-muted">{p.dispositivo}</span>}
                    </div>
                    <div className="text-sm" style={{ marginTop: 6 }}>
                      Sta guardando: <b>{p.pagina || '—'}</b>
                    </div>
                    {p.ultima && (
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                        Ultima modifica: {frase(p.ultima)}{p.ultima.descrizione ? ` — ${p.ultima.descrizione}` : ''} · {tempoFa(p.ultima.quando)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="dash-label">Ultimo accesso</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scollegati.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--gray-200)' }}>
                <div style={{ minWidth: 0 }}>
                  <button type="button" onClick={() => { setFUtente(p.id); setFPeriodo('tutto'); setScheda('registro') }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-900)', textAlign: 'left' }}
                    title="Vedi cosa ha fatto">
                    {p.nome} {p.cognome}
                  </button>
                  <span className="text-xs text-muted" style={{ marginLeft: 6 }}>{p.ruolo}</span>
                  {p.pagina && p.pagina !== 'USCITO' && p.visto && (
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>era su {p.pagina}</div>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', color: p.visto ? 'var(--gray-700)' : 'var(--gray-400)' }}>
                  {p.visto ? tempoFa(p.visto) : 'mai entrato'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {PERIODI.map(p => (
              <button key={p.id} type="button" className={`chip ${fPeriodo === p.id ? 'on' : ''}`}
                style={{ height: 36, padding: '0 14px' }} onClick={() => setFPeriodo(p.id)}>{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
            <select className="form-control" value={fUtente} onChange={e => setFUtente(e.target.value)} aria-label="Persona">
              <option value="">Tutte le persone</option>
              {utenti.map(u => <option key={u.id} value={u.id}>{u.cognome} {u.nome}</option>)}
              <option value="database">Dal pannello del database</option>
            </select>
            <select className="form-control" value={fTabella} onChange={e => setFTabella(e.target.value)} aria-label="Argomento">
              <option value="">Tutti gli argomenti</option>
              {tabellePresenti.map(t => {
                const nome = TABELLE[t]?.[1] || t
                return <option key={t} value={t}>{nome.charAt(0).toUpperCase() + nome.slice(1)}</option>
              })}
            </select>
            <select className="form-control" value={fTipo} onChange={e => setFTipo(e.target.value)} aria-label="Tipo">
              <option value="">Tutte le azioni</option>
              <option value="INSERT">Aggiunte</option>
              <option value="UPDATE">Modifiche</option>
              <option value="DELETE">Eliminazioni</option>
              <option value="ACCESSI">Accessi e uscite</option>
            </select>
            <input className="form-control" placeholder="Cerca un nome…" value={cerca} onChange={e => setCerca(e.target.value)} aria-label="Cerca" />
          </div>

          <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
            {filtrate.length} {filtrate.length === 1 ? 'voce' : 'voci'}
            {(fUtente || fTabella || fTipo || cerca) && (
              <button type="button" onClick={() => { setFUtente(''); setFTabella(''); setFTipo(''); setCerca('') }}
                style={{ marginLeft: 8, background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
                Togli i filtri
              </button>
            )}
          </div>

          {gruppi.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><Icon name="attivita" size={34} /></div>
              <p>Nessuna voce in questo periodo</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gruppi.map(g => {
                const r = g.righe[0]
                const t = TIPI[r.tipo]
                const n = g.righe.length
                const giorno = giornoEsteso(r.quando)
                const intestazione = giorno !== giornoCorrente
                giornoCorrente = giorno
                const espandibile = n > 1 || !!r.modifiche
                const aperta = !!aperte[g.chiave]
                return (
                  <div key={g.chiave}>
                    {intestazione && <div className="dash-label" style={{ marginTop: 10 }}>{giorno}</div>}
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--gray-200)' }}>
                      <div role={espandibile ? 'button' : undefined} tabIndex={espandibile ? 0 : undefined}
                        onClick={espandibile ? () => setAperte(a => ({ ...a, [g.chiave]: !a[g.chiave] })) : undefined}
                        onKeyDown={espandibile ? (e) => { if (e.key === 'Enter') setAperte(a => ({ ...a, [g.chiave]: !a[g.chiave] })) } : undefined}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: espandibile ? 'pointer' : 'default' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name={t.icon} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: '0.86rem', lineHeight: 1.45 }}>
                          <b>{nomeUtente(r.utente_id)}</b> {frase(r, n)}
                          {n === 1 && r.descrizione && <>: <b style={{ color: t.color }}>{r.descrizione}</b></>}
                          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                            {n > 1 ? `${ora(g.righe[n - 1].quando)} – ${ora(r.quando)}` : ora(r.quando)}
                            {espandibile && <span style={{ marginLeft: 6 }}>· {aperta ? 'nascondi' : 'dettagli'}</span>}
                          </div>
                        </div>
                      </div>
                      {aperta && n === 1 && <Dettaglio r={r} />}
                      {aperta && n > 1 && (
                        <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {g.righe.map(x => (
                            <div key={x.chiave} style={{ fontSize: '0.82rem' }}>
                              <span className="text-muted">{ora(x.quando)}</span> · {x.descrizione || '—'}
                              <Dettaglio r={x} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {altro && (
            <button className="btn btn-outline btn-block" style={{ marginTop: 14 }} onClick={() => setLimite(l => l + PASSO)}>
              Carica voci più vecchie
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Numero({ n, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: '0.66rem', color, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
