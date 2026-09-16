import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'

// Ogni sezione dell'app corrisponde a uno o due "permessi" nel database.
// "Partecipa" = puo' entrare e consultare. "Gestisce" = puo' anche modificare.
const SEZIONI = [
  { key: 'catechismo', label: 'Catechismo', icon: 'catechismo',
    base: 'catechista', resp: null,
    sempre: ['admin', 'parroco', 'segreteria', 'responsabile'] },
  { key: 'comitato', label: 'Comitato', icon: 'comitato',
    base: 'comitato', resp: 'responsabile_comitato',
    sempre: ['admin', 'parroco', 'responsabile'] },
  { key: 'coro', label: 'Coro', icon: 'coro',
    base: 'corista', resp: 'responsabile_coro',
    sempre: ['admin', 'parroco', 'responsabile'] },
  { key: 'neo', label: 'Neocatecumenali', icon: 'neocatecumenali',
    base: 'neocatecumenale', resp: 'responsabile_neo',
    sempre: ['admin', 'parroco', 'responsabile'] },
]

export default function Permessi() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const puoGestire = ['admin', 'parroco'].some(r => tuttiRuoli.includes(r))

  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [salvando, setSalvando] = useState(null)

  useEffect(() => { if (profilo) carica() }, [profilo])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('profili')
      .select('id, nome, cognome, username, ruolo, ruoli_extra, attivo')
      .eq('attivo', true).order('cognome')
    setUtenti(data || [])
    setLoading(false)
  }

  // Che livello ha questa persona su questa sezione
  const livello = (u, sez) => {
    if (sez.sempre.includes(u.ruolo)) return 'sempre'
    const extra = u.ruoli_extra || []
    if (sez.resp && (u.ruolo === sez.resp || extra.includes(sez.resp))) return 'gestisce'
    if (u.ruolo === sez.base || extra.includes(sez.base)) return 'partecipa'
    return 'no'
  }

  const cambia = async (u, sez, nuovo) => {
    setSalvando(u.id + sez.key)
    const extra = (u.ruoli_extra || []).filter(r => r !== sez.base && r !== sez.resp)
    if (nuovo === 'partecipa') extra.push(sez.base)
    if (nuovo === 'gestisce' && sez.resp) extra.push(sez.resp)

    const { error } = await supabase.from('profili')
      .update({ ruoli_extra: extra }).eq('id', u.id)
    setSalvando(null)
    if (error) return toast('Errore: ' + error.message, 'error')
    setUtenti(prev => prev.map(x => x.id === u.id ? { ...x, ruoli_extra: extra } : x))
    toast('Permessi aggiornati', 'success')
  }

  const filtrati = utenti.filter(u =>
    `${u.nome} ${u.cognome} ${u.username || ''}`.toLowerCase().includes(cerca.toLowerCase()))

  if (!puoGestire) {
    return <div style={{ padding: 16 }}><div className="empty-state">
      <p>Questa sezione &egrave; riservata ad amministratore e parroco.</p>
    </div></div>
  }

  const Selettore = ({ u, sez }) => {
    const liv = livello(u, sez)
    const busy = salvando === u.id + sez.key
    if (liv === 'sempre') {
      return <span className="badge badge-gray" title="Dipende dal ruolo principale">dal ruolo</span>
    }
    return (
      <select
        className="form-control"
        disabled={busy}
        style={{ height: 36, fontSize: '0.8rem', padding: '0 8px', width: 118 }}
        value={liv}
        onChange={e => cambia(u, sez, e.target.value)}
      >
        <option value="no">Non vede</option>
        <option value="partecipa">Partecipa</option>
        {sez.resp && <option value="gestisce">Gestisce</option>}
      </select>
    )
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ToastContainer />

      <div className="mb-4">
        <h1>Permessi</h1>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
          Scegli, persona per persona, quali sezioni pu&ograve; vedere e quali pu&ograve; modificare.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'var(--primary-bg)', border: 'none' }}>
        <div className="card-body" style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Icon name="presenze" size={18} style={{ color: 'var(--primary)', marginTop: 1 }} />
          <div className="text-sm" style={{ color: 'var(--gray-700)' }}>
            <strong>Partecipa</strong>: entra nella sezione e consulta.{' '}
            <strong>Gestisce</strong>: pu&ograve; anche creare e modificare.{' '}
            <strong>dal ruolo</strong>: l&rsquo;accesso arriva gi&agrave; dal ruolo principale
            (amministratore, parroco, segreteria) e non si toglie da qui.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 11, marginBottom: 16 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input placeholder="Cerca una persona..." value={cerca} onChange={e => setCerca(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Nunito, sans-serif', fontSize: '0.9rem', background: 'transparent', color: 'var(--gray-900)' }} />
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <>
          {/* Tabella (computer) */}
          <div className="card only-desk" style={{ overflow: 'hidden' }}>
            <div className="table-wrap">
              <table className="bimbi-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Ruolo</th>
                    {SEZIONI.map(s => <th key={s.key}>{s.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtrati.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>
                        {u.cognome} {u.nome}
                        <div className="text-xs text-muted">@{u.username}</div>
                      </td>
                      <td><span className="badge badge-gray">{u.ruolo}</span></td>
                      {SEZIONI.map(s => (
                        <td key={s.key}><Selettore u={u} sez={s} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schede (telefono) */}
          <div className="only-mob">
            {filtrati.map(u => (
              <div key={u.id} className="card" style={{ marginBottom: 10 }}>
                <div className="card-body">
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{u.cognome} {u.nome}</div>
                      <div className="text-xs text-muted">@{u.username}</div>
                    </div>
                    <span className="badge badge-gray">{u.ruolo}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {SEZIONI.map(s => (
                      <div key={s.key} className="flex items-center justify-between" style={{ gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600 }}>
                          <Icon name={s.icon} size={16} style={{ color: 'var(--gray-500)' }} />
                          {s.label}
                        </span>
                        <Selettore u={u} sez={s} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtrati.length === 0 && (
            <div className="empty-state"><p>Nessuna persona trovata.</p></div>
          )}
        </>
      )}
    </div>
  )
}
