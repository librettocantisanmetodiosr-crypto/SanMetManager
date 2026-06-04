import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { inviaBenvenuto } from '../../lib/emailService'
import { emailConfigured } from '../../lib/emailConfig'

const RUOLI = [
  { value: 'admin',            label: 'Admin',         badge: 'badge-red',   desc: 'Accesso completo a tutto' },
  { value: 'parroco',          label: 'Parroco',       badge: 'badge-red',   desc: 'Accesso completo a tutto' },
  { value: 'segreteria',       label: 'Segreteria',    badge: 'badge-blue',  desc: 'Gestione catechismo e utenti' },
  { value: 'catechista',       label: 'Catechista',    badge: 'badge-green', desc: 'Presenze e bambini della propria classe' },
  { value: 'comitato',         label: 'Comitato',      badge: 'badge-blue',  desc: 'Calendario, lettere, rubrica' },
  { value: 'responsabile_coro',label: 'Resp. Coro',    badge: 'badge-gold',  desc: 'Gestione canti e coristi' },
  { value: 'corista',          label: 'Corista',       badge: 'badge-gold',  desc: 'Visualizza canti e lancia dal responsabile' },
  { value: 'responsabile_neo', label: 'Resp. Neo.',    badge: 'badge-blue',  desc: 'Gestione comunità neocatecumenali' },
  { value: 'neocatecumenale',  label: 'Neocatec.',     badge: 'badge-gray',  desc: 'Comunità, stanze, avvisi' },
]

const RUOLI_RISERVATI = ['admin', 'parroco']

const vuotoNuovo = { email: '', password: '', nome: '', cognome: '', username: '', telefono: '', ruolo: 'catechista' }
const vuotoModifica = { username: '', nome: '', cognome: '', telefono: '', ruolo: 'catechista' }

export default function Utenti() {
  const { profilo, resetPassword } = useAuth()
  const { toast, ToastContainer } = useToast()

  const [utenti, setUtenti] = useState([])
  const [classi, setClassi] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalModifica, setModalModifica] = useState(null)
  const [modalNuovo, setModalNuovo] = useState(false)
  const [formModifica, setFormModifica] = useState(vuotoModifica)
  const [formNuovo, setFormNuovo] = useState(vuotoNuovo)
  const [saving, setSaving] = useState(false)
  const [creando, setCreando] = useState(false)
  const [filtroRuolo, setFiltroRuolo] = useState('')
  const [cerca, setCerca] = useState('')
  const [mostraPassword, setMostraPassword] = useState(false)
  const [modalCredenziali, setModalCredenziali] = useState(null)
  const [modalReset, setModalReset] = useState(null)
  const [nuovaPassword, setNuovaPassword] = useState('')
  const [mostraPasswordReset, setMostraPasswordReset] = useState(false)
  const [inviandoReset, setInviandoReset] = useState(false)

  const isAdmin = ['admin', 'parroco'].includes(profilo?.ruolo)

  // Segreteria può creare utenti ma non admin/parroco
  const ruoliAssegnabili = isAdmin
    ? RUOLI
    : RUOLI.filter(r => !RUOLI_RISERVATI.includes(r.value))

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data: u } = await supabase.from('profili').select('*').eq('attivo', true).order('cognome')
    const { data: cl } = await supabase.from('classi').select('id, nome, classi_catechisti(catechista_id)').eq('attiva', true)
    setUtenti(u || [])
    setClassi(cl || [])
    setLoading(false)
  }

  const classiDiUtente = (uid) =>
    classi.filter(c => c.classi_catechisti?.some(cc => cc.catechista_id === uid)).map(c => c.nome).join(', ')

  /* ── Crea nuovo utente ─────────────────────────────────────── */
  const creaUtente = async () => {
    const { email, password, nome, cognome, username, ruolo } = formNuovo
    if (!email.trim() || !password || !nome.trim() || !cognome.trim() || !username.trim()) {
      return toast('Compila tutti i campi obbligatori (*)', 'error')
    }
    if (password.length < 6) return toast('La password deve essere di almeno 6 caratteri', 'error')
    if (!RUOLI_RISERVATI.includes(ruolo) || isAdmin) {
      // ok
    } else {
      return toast('Non puoi assegnare questo ruolo', 'error')
    }
    setCreando(true)
    try {
      // Client temporaneo: la signUp non tocca la sessione admin corrente
      const tempClient = createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_ANON_KEY
      )
      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Non inviare email di conferma Supabase (usiamo credenziali manuali)
          emailRedirectTo: null,
          data: { skip_confirmation: true },
        },
      })
      if (authErr) {
        if (authErr.message.toLowerCase().includes('already registered') || authErr.message.toLowerCase().includes('already been registered')) throw new Error('Email già registrata')
        if (authErr.message.toLowerCase().includes('rate limit') || authErr.status === 429) throw new Error('Troppi tentativi in poco tempo — aspetta qualche minuto e riprova. In alternativa, disabilita le email di conferma su Supabase → Authentication → Email → deseleziona "Confirm email".')
        throw authErr
      }
      if (!authData.user) throw new Error('Creazione account fallita — riprova')

      // Inserisce il profilo usando il client admin (con sessione corrente)
      const { error: profErr } = await supabase.from('profili').insert({
        id: authData.user.id,
        username: username.trim(),
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: formNuovo.telefono.trim() || null,
        ruolo,
      })
      if (profErr) {
        if (profErr.message.includes('unique')) throw new Error('Username già in uso, scegline un altro')
        // Se profili insert è bloccato da RLS, mostra istruzione
        if (profErr.code === '42501') throw new Error('Permesso negato: esegui in Supabase SQL editor le policy mancanti (vedi istruzioni)')
        throw profErr
      }

      setModalNuovo(false)
      setFormNuovo(vuotoNuovo)
      carica()

      // Mostra credenziali e invia email se configurata
      const nuovoUtente = { nome, cognome, email: email.trim(), password, ruolo }
      setModalCredenziali(nuovoUtente)
      if (emailConfigured()) {
        inviaBenvenuto(nuovoUtente)
          .then(() => toast('Email di benvenuto inviata a ' + email.trim(), 'success'))
          .catch(() => toast('Email non inviata — controlla la configurazione EmailJS', 'error'))
      }
    } catch (e) {
      toast(e.message || 'Errore nella creazione', 'error')
    }
    setCreando(false)
  }

  /* ── Modifica utente esistente ─────────────────────────────── */
  const salvaModifica = async () => {
    if (!formModifica.nome || !formModifica.cognome) return toast('Nome e cognome obbligatori', 'error')
    setSaving(true)
    const { error } = await supabase.from('profili').update({
      username: formModifica.username,
      nome: formModifica.nome,
      cognome: formModifica.cognome,
      telefono: formModifica.telefono,
      ruolo: formModifica.ruolo,
    }).eq('id', modalModifica.id)

    if (error) {
      if (error.code === '42501') toast('Permesso negato: aggiungi la policy di update per admin (vedi schema.sql)', 'error')
      else toast('Errore nel salvataggio', 'error')
    } else {
      toast('Utente aggiornato ✓', 'success')
      setModalModifica(null)
      carica()
    }
    setSaving(false)
  }

  const disattiva = async (uid) => {
    if (!window.confirm('Disattivare questo utente? Non potrà più accedere.')) return
    await supabase.from('profili').update({ attivo: false }).eq('id', uid)
    toast('Utente disattivato', 'success')
    carica()
  }

  const apriReset = (u) => {
    setNuovaPassword('')
    setMostraPasswordReset(false)
    setModalReset(u)
  }

  const eseguiReset = async () => {
    if (nuovaPassword.length < 6) return toast('La password deve essere di almeno 6 caratteri', 'error')
    setInviandoReset(true)
    const { error } = await supabase.rpc('reset_user_password', {
      target_user_id: modalReset.id,
      new_password: nuovaPassword,
    })
    setInviandoReset(false)
    if (error) {
      if (error.message?.includes('Non autorizzato')) toast('Non hai i permessi per questa operazione', 'error')
      else if (error.message?.includes('reset_user_password')) toast('Funzione non trovata — esegui prima il SQL in Supabase (vedi istruzioni)', 'error')
      else toast('Errore: ' + error.message, 'error')
    } else {
      setModalReset(null)
      setModalCredenziali({ nome: modalReset.nome, cognome: modalReset.cognome, password: nuovaPassword, soloReset: true })
      toast('Password aggiornata ✓', 'success')
    }
  }

  const badgeRuolo = (ruolo) => {
    const r = RUOLI.find(x => x.value === ruolo)
    return <span className={`badge ${r?.badge || 'badge-gray'}`}>{r?.label || ruolo}</span>
  }

  const filtrati = utenti.filter(u => {
    const okR = !filtroRuolo || u.ruolo === filtroRuolo
    const okC = !cerca || `${u.nome} ${u.cognome} ${u.username}`.toLowerCase().includes(cerca.toLowerCase())
    return okR && okC
  })

  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <h1>👤 Utenti</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge badge-gray">{utenti.length} totali</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setFormNuovo(vuotoNuovo); setModalNuovo(true) }}>
            ＋ Nuovo utente
          </button>
        </div>
      </div>

      {/* Filtri ruolo */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {RUOLI.filter(r => utenti.some(u => u.ruolo === r.value)).map(r => (
          <div key={r.value}
            onClick={() => setFiltroRuolo(filtroRuolo === r.value ? '' : r.value)}
            style={{
              flexShrink: 0, borderRadius: 20, padding: '6px 14px',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: filtroRuolo === r.value ? 'var(--primary)' : '#fff',
              color: filtroRuolo === r.value ? '#fff' : 'var(--gray-700)',
              border: '1.5px solid', borderColor: filtroRuolo === r.value ? 'var(--primary)' : 'var(--gray-200)',
            }}>
            {r.label} ({utenti.filter(u => u.ruolo === r.value).length})
          </div>
        ))}
      </div>

      <input className="form-control" placeholder="Cerca utente..." value={cerca}
        onChange={e => setCerca(e.target.value)} style={{ marginBottom: 14 }} />

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrati.map(u => (
            <div key={u.id} className="card">
              <div className="card-body" style={{ padding: '13px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{u.nome} {u.cognome}</div>
                    <div className="text-xs text-muted">@{u.username}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {badgeRuolo(u.ruolo)}
                    <button className="btn btn-outline btn-sm btn-icon" title="Reimposta password" onClick={() => apriReset(u)}>🔑</button>
                    <button className="btn btn-outline btn-sm btn-icon" onClick={() => {
                      setFormModifica({ username: u.username || '', nome: u.nome || '', cognome: u.cognome || '', telefono: u.telefono || '', ruolo: u.ruolo })
                      setModalModifica(u)
                    }}>✏️</button>
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => disattiva(u.id)}>🗑</button>
                  </div>
                </div>
                {u.telefono && <div className="text-sm text-muted">📞 {u.telefono}</div>}
                {u.ruolo === 'catechista' && classiDiUtente(u.id) && (
                  <div className="text-sm" style={{ color: 'var(--primary)', marginTop: 2 }}>
                    🏫 {classiDiUtente(u.id)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtrati.length === 0 && (
            <div className="empty-state"><div className="icon">👤</div><p>Nessun utente trovato</p></div>
          )}
        </div>
      )}

      {/* ── Modal: NUOVO UTENTE ─────────────────────────────── */}
      {modalNuovo && (
        <div className="modal-overlay" onClick={() => setModalNuovo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">＋ Nuovo Utente</div>

            <div style={{ background: 'var(--primary-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--primary)' }}>
              Dopo la creazione vedrai le credenziali da condividere. Puoi copiarle o inviarle via email/WhatsApp.
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input className="form-control" value={formNuovo.nome}
                  onChange={e => setFormNuovo(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cognome *</label>
                <input className="form-control" value={formNuovo.cognome}
                  onChange={e => setFormNuovo(f => ({ ...f, cognome: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Username * (per il profilo)</label>
              <input className="form-control" placeholder="es. mario.rossi"
                value={formNuovo.username}
                onChange={e => setFormNuovo(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '.') }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Email * (usata per accedere)</label>
              <input type="email" className="form-control" value={formNuovo.email}
                onChange={e => setFormNuovo(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Password temporanea * (min. 6 caratteri)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostraPassword ? 'text' : 'password'}
                  className="form-control"
                  value={formNuovo.password}
                  onChange={e => setFormNuovo(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setMostraPassword(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--gray-500)' }}
                >{mostraPassword ? '🙈' : '👁'}</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input type="tel" className="form-control" value={formNuovo.telefono}
                onChange={e => setFormNuovo(f => ({ ...f, telefono: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Ruolo</label>
              <select className="form-control" value={formNuovo.ruolo}
                onChange={e => setFormNuovo(f => ({ ...f, ruolo: e.target.value }))}>
                {ruoliAssegnabili.map(r => (
                  <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalNuovo(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={creaUtente} disabled={creando}>
                {creando ? <><div className="spinner" style={{ borderTopColor: '#fff' }} />Creazione…</> : 'Crea utente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: CREDENZIALI NUOVO UTENTE ─────────────────── */}
      {modalCredenziali && (
        <div className="modal-overlay" onClick={() => setModalCredenziali(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">✅ Utente creato</div>
            <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', marginBottom: 8 }}>
                {modalCredenziali.soloReset ? 'Nuova password per:' : 'Credenziali da comunicare all\'utente:'}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{modalCredenziali.nome} {modalCredenziali.cognome}</div>
              {!modalCredenziali.soloReset && (
                <div style={{ fontSize: '0.85rem', marginTop: 6 }}>
                  <span style={{ color: 'var(--gray-500)' }}>Email: </span>
                  <strong>{modalCredenziali.email}</strong>
                </div>
              )}
              <div style={{ fontSize: '0.85rem', marginTop: 6 }}>
                <span style={{ color: 'var(--gray-500)' }}>Password: </span>
                <strong style={{ fontFamily: 'monospace', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontSize: '1rem' }}>{modalCredenziali.password}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                <span style={{ color: 'var(--gray-500)' }}>Link app: </span>
                <strong>san-met-manager-dda9.vercel.app</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-outline btn-block"
                onClick={() => {
                  const testo = modalCredenziali.soloReset
                    ? `Ciao ${modalCredenziali.nome}!\n\nLa tua password su SanMetManager è stata reimpostata:\n\nNuova password: ${modalCredenziali.password}\nLink: https://san-met-manager-dda9.vercel.app\n\nParrocchia San Metodio`
                    : `Ciao ${modalCredenziali.nome}!\n\nTi comunico le credenziali per accedere a SanMetManager:\n\nEmail: ${modalCredenziali.email}\nPassword: ${modalCredenziali.password}\nLink: https://san-met-manager-dda9.vercel.app\n\nParrocchia San Metodio`
                  navigator.clipboard?.writeText(testo)
                  toast('Testo copiato negli appunti ✓', 'success')
                }}
              >📋 Copia</button>
              {!modalCredenziali.soloReset && (
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => {
                    const body = encodeURIComponent(`Ciao ${modalCredenziali.nome}!\n\nTi comunico le credenziali per accedere a SanMetManager:\n\nEmail: ${modalCredenziali.email}\nPassword: ${modalCredenziali.password}\nLink: https://san-met-manager-dda9.vercel.app\n\nParrocchia San Metodio, Siracusa`)
                    window.open(`mailto:${modalCredenziali.email}?subject=Accesso%20SanMetManager&body=${body}`)
                  }}
                >✉️ Email</button>
              )}
              <button className="btn btn-primary btn-block" onClick={() => setModalCredenziali(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: RESET PASSWORD ───────────────────────────── */}
      {modalReset && (
        <div className="modal-overlay" onClick={() => setModalReset(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">🔑 Nuova password</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 16 }}>
              Imposta una nuova password per <strong>{modalReset.nome} {modalReset.cognome}</strong>.
              Dopo potrai copiarla e comunicarla direttamente all'utente.
            </p>
            <div className="form-group">
              <label className="form-label">Nuova password (min. 6 caratteri)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostraPasswordReset ? 'text' : 'password'}
                  className="form-control"
                  placeholder="••••••••"
                  value={nuovaPassword}
                  onChange={e => setNuovaPassword(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && eseguiReset()}
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setMostraPasswordReset(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--gray-500)' }}>
                  {mostraPasswordReset ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalReset(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={eseguiReset} disabled={inviandoReset}>
                {inviandoReset ? 'Aggiornamento...' : '✓ Salva password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: MODIFICA UTENTE ──────────────────────────── */}
      {modalModifica && (
        <div className="modal-overlay" onClick={() => setModalModifica(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Modifica Utente</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-control" value={formModifica.nome}
                  onChange={e => setFormModifica(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cognome</label>
                <input className="form-control" value={formModifica.cognome}
                  onChange={e => setFormModifica(f => ({ ...f, cognome: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-control" value={formModifica.username}
                onChange={e => setFormModifica(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input type="tel" className="form-control" value={formModifica.telefono}
                onChange={e => setFormModifica(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ruolo</label>
              <select className="form-control" value={formModifica.ruolo}
                onChange={e => setFormModifica(f => ({ ...f, ruolo: e.target.value }))}>
                {ruoliAssegnabili.map(r => (
                  <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModalModifica(null)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={salvaModifica} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
