import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const AZIONI_LABEL = {
  LOGIN:            { label: 'Accesso',           icon: '🔓', color: 'var(--primary)' },
  LOGOUT:           { label: 'Uscita',             icon: '🔒', color: 'var(--gray-500)' },
  NUOVO_BAMBINO:    { label: 'Bambino aggiunto',   icon: '👦', color: 'var(--blue)' },
  MODIFICA_BAMBINO: { label: 'Bambino modificato', icon: '✏️', color: 'var(--blue)' },
  ELIMINA_BAMBINO:  { label: 'Bambino rimosso',    icon: '🗑',  color: 'var(--red)' },
  NUOVA_CLASSE:     { label: 'Classe creata',      icon: '🏫', color: 'var(--primary)' },
  MODIFICA_CLASSE:  { label: 'Classe modificata',  icon: '✏️', color: 'var(--primary)' },
  NUOVO_UTENTE:     { label: 'Utente creato',      icon: '👤', color: 'var(--primary)' },
  MODIFICA_UTENTE:  { label: 'Utente modificato',  icon: '✏️', color: 'var(--gray-700)' },
  DISATTIVA_UTENTE: { label: 'Utente disattivato', icon: '🚫', color: 'var(--red)' },
}

const fmtData = (ts) => {
  const d = new Date(ts)
  const oggi = new Date()
  const ieri = new Date(oggi); ieri.setDate(oggi.getDate() - 1)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === oggi.toDateString()) return `Oggi ${ora}`
  if (d.toDateString() === ieri.toDateString()) return `Ieri ${ora}`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' ' + ora
}

export default function Attivita() {
  const [log, setLog] = useState([])
  const [utenti, setUtenti] = useState([])
  const [utentiMap, setUtentiMap] = useState({})
  const [lastLogin, setLastLogin] = useState({})
  const [loading, setLoading] = useState(true)
  const [sqlMancante, setSqlMancante] = useState(false)
  const [filtroUtente, setFiltroUtente] = useState('')
  const [filtroAzione, setFiltroAzione] = useState('')

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    setSqlMancante(false)
    try {
      const [resLog, resProfili] = await Promise.all([
        supabase.from('log_attivita')
          .select('id, azione, dettaglio, created_at, utente_id')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('profili')
          .select('id, nome, cognome, username')
          .eq('attivo', true)
          .order('cognome'),
      ])

      if (resLog.error?.code === '42P01' || resLog.error?.code === '42703') {
        setSqlMancante(true); setLoading(false); return
      }
      if (resLog.error) { setSqlMancante(true); setLoading(false); return }

      const profili = resProfili.data || []
      const map = Object.fromEntries(profili.map(u => [u.id, u]))
      setLog(resLog.data || [])
      setUtenti(profili)
      setUtentiMap(map)

      // RPC opzionale — se non esiste non blocca la pagina
      const resLogin = await supabase.rpc('get_users_last_login')
      if (!resLogin.error && resLogin.data) {
        const loginMap = {}
        resLogin.data.forEach(r => { loginMap[r.profilo_id] = r.last_sign_in })
        setLastLogin(loginMap)
      }
    } catch (e) {
      setSqlMancante(true)
    }
    setLoading(false)
  }

  const filtrati = log.filter(r => {
    const okU = !filtroUtente || r.utente_id === filtroUtente
    const okA = !filtroAzione || r.azione === filtroAzione
    return okU && okA
  })

  return (
    <div style={{ padding: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <h1>📋 Attività</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(filtroUtente || filtroAzione) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFiltroUtente(''); setFiltroAzione('') }}>
              ✕ Reset
            </button>
          )}
          <span className="badge badge-gray">{filtrati.length} eventi</span>
        </div>
      </div>

      {sqlMancante && (
        <div style={{ background:'var(--red-bg)', color:'var(--red)', borderRadius:10, padding:'14px 16px', marginBottom:20, fontSize:'0.85rem', lineHeight:1.6 }}>
          <strong>⚠️ Tabella mancante</strong> — Esegui il SQL su Supabase per attivare questa funzione.<br/>
          Vai su <strong>Supabase → SQL Editor</strong> e crea la tabella <code>log_attivita</code>.
        </div>
      )}

      {/* Ultimo accesso per utente */}
      {utenti.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-500)', marginBottom: 8 }}>
            Ultimo accesso utenti
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {utenti.map(u => {
              const ts = lastLogin[u.id]
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{u.nome} {u.cognome}</span>
                    <span className="text-xs text-muted" style={{ marginLeft: 6 }}>@{u.username}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: ts ? 'var(--primary)' : 'var(--gray-400)', fontWeight: 600 }}>
                    {ts ? fmtData(ts) : 'Mai'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="form-control" style={{ flex: 1 }} value={filtroUtente} onChange={e => setFiltroUtente(e.target.value)}>
          <option value="">Tutti gli utenti</option>
          {utenti.map(u => <option key={u.id} value={u.id}>{u.nome} {u.cognome}</option>)}
        </select>
        <select className="form-control" style={{ flex: 1 }} value={filtroAzione} onChange={e => setFiltroAzione(e.target.value)}>
          <option value="">Tutte le azioni</option>
          {Object.entries(AZIONI_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : filtrati.length === 0 ? (
        <div className="empty-state"><div className="icon">📋</div><p>Nessuna attività registrata</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtrati.map(r => {
            const meta = AZIONI_LABEL[r.azione] || { label: r.azione, icon: '•', color: 'var(--gray-600)' }
            const autore = utentiMap[r.utente_id]
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.2rem', marginTop: 1, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: meta.color }}>{meta.label}</span>
                    {r.dettaglio && <span className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dettaglio}</span>}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    {autore ? `${autore.nome} ${autore.cognome}` : 'Utente sconosciuto'}
                    {' · '}
                    {fmtData(r.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
