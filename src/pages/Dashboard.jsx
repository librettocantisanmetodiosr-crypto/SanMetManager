import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import Icon from '../components/Icon'

const oggiISO = () => new Date().toISOString().split('T')[0]

const formattaData = (iso, opts) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT',
    opts || { weekday: 'long', day: 'numeric', month: 'long' })

export default function Dashboard() {
  const { profilo, tuttiRuoli } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [bacheca, setBacheca] = useState([])
  const [riepilogo, setRiepilogo] = useState(null)
  const [eventi, setEventi] = useState([])

  const isAdmin = ['admin','parroco','segreteria'].some(r => tuttiRuoli.includes(r))
  const hasCatechismo = ['admin','parroco','segreteria','catechista','responsabile'].some(r => tuttiRuoli.includes(r))
  const hasComitato = ['admin','parroco','comitato','responsabile_comitato'].some(r => tuttiRuoli.includes(r))
  const hasComitaEdit = ['admin','parroco','responsabile_comitato'].some(r => tuttiRuoli.includes(r))
  const hasCoro = ['admin','parroco','responsabile_coro','corista'].some(r => tuttiRuoli.includes(r))
  const hasNeo = ['admin','parroco','neocatecumenale','responsabile_neo'].some(r => tuttiRuoli.includes(r))

  useEffect(() => {
    if (!profilo) return
    caricaBacheca()
    caricaEventi()
    if (isAdmin) caricaStats()
    if (hasCatechismo) caricaRiepilogo()
  }, [profilo])

  const caricaStats = async () => {
    const [{ count: bambini }, { count: classi }, { count: utenti }] = await Promise.all([
      supabase.from('bambini').select('*', { count: 'exact', head: true }).eq('attivo', true),
      supabase.from('classi').select('*', { count: 'exact', head: true }).eq('attiva', true),
      supabase.from('profili').select('*', { count: 'exact', head: true }).eq('attivo', true),
    ])
    setStats({ bambini: bambini || 0, classi: classi || 0, utenti: utenti || 0 })
  }

  // Riepilogo del catechismo: com'e' andato l'ultimo incontro e quando e' il prossimo
  const caricaRiepilogo = async () => {
    const oggi = oggiISO()
    const [ult, pros, bamb] = await Promise.all([
      supabase.from('date_catechismo').select('id, data, descrizione')
        .lte('data', oggi).order('data', { ascending: false }).limit(1),
      supabase.from('date_catechismo').select('id, data, descrizione')
        .gt('data', oggi).order('data', { ascending: true }).limit(1),
      supabase.from('bambini').select('*', { count: 'exact', head: true }).eq('attivo', true),
    ])

    const ultima = ult.data?.[0] || null
    let presenti = 0, registrate = 0
    if (ultima) {
      const { data: pres } = await supabase.from('presenze').select('stato').eq('data_id', ultima.id)
      registrate = pres?.length || 0
      presenti = (pres || []).filter(p => p.stato === 'P').length
    }

    setRiepilogo({
      ultima,
      prossima: pros.data?.[0] || null,
      presenti,
      registrate,
      totBambini: bamb.count || 0,
    })
  }

  const caricaEventi = async () => {
    const { data } = await supabase.from('eventi_calendario')
      .select('id, titolo, data, ora_inizio, luogo, colore')
      .gte('data', oggiISO()).order('data', { ascending: true }).limit(4)
    setEventi(data || [])
  }

  const caricaBacheca = async () => {
    const { data } = await supabase
      .from('bacheca').select('id, titolo, testo, destinatari, created_at')
      .eq('attivo', true).order('created_at', { ascending: false }).limit(3)
    setBacheca(data || [])
  }

  const ora = new Date().getHours()
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'

  const shortcuts = [
    hasCatechismo && { icon: 'presenze', label: 'Presenze', path: '/catechismo/presenze', color: 'var(--primary)' },
    hasCatechismo && { icon: 'bambini', label: 'Bambini', path: '/catechismo/bambini', color: 'var(--primary)' },
    hasCatechismo && { icon: 'diario', label: 'Diario', path: '/catechismo/attivita', color: 'var(--primary)' },
    isAdmin        && { icon: 'classi', label: 'Classi', path: '/catechismo/classi', color: 'var(--primary)' },
    hasComitato    && { icon: 'calendario', label: 'Calendario', path: '/comitato/calendario', color: 'var(--blue)' },
    hasComitaEdit  && { icon: 'lettere', label: 'Lettere', path: '/comitato/lettere', color: 'var(--blue)' },
    hasCoro        && { icon: 'canti', label: 'Canti', path: '/coro/canti', color: 'var(--gold)' },
    hasNeo         && { icon: 'stanze', label: 'Stanze', path: '/neo/stanze', color: 'var(--red)' },
    isAdmin        && { icon: 'utenti', label: 'Utenti', path: '/admin/utenti', color: 'var(--gray-700)' },
  ].filter(Boolean)

  const perc = riepilogo && riepilogo.registrate > 0
    ? Math.round((riepilogo.presenti / riepilogo.registrate) * 100) : 0
  const daRegistrare = riepilogo ? Math.max(0, riepilogo.totBambini - riepilogo.registrate) : 0

  return (
    <div style={{ padding: 16 }}>

      {/* Saluto */}
      <div style={{
        borderRadius: 16, marginBottom: 20, overflow: 'hidden',
        position: 'relative', minHeight: 120,
        backgroundImage: 'url(/chiesa-drone.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center 55%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(40,72,54,0.86) 0%, rgba(52,72,92,0.78) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '22px 20px', color: '#fff' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
            {saluto}, {profilo?.nome || 'benvenuto'}
          </div>
          <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="dash-grid">

        {/* ── COLONNA PRINCIPALE ─────────────────────── */}
        <div>

          {/* Riepilogo catechismo */}
          {hasCatechismo && riepilogo && (
            <>
              <div className="dash-label">Catechismo</div>
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-body">
                  {!riepilogo.ultima ? (
                    <div className="text-sm text-muted">Nessun incontro registrato finora.</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)' }}>
                            Ultimo incontro &middot; {formattaData(riepilogo.ultima.data, { day: 'numeric', month: 'long' })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 7 }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                              {riepilogo.presenti}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-500)' }}>
                              su {riepilogo.registrate} registrati
                            </span>
                          </div>
                        </div>
                        <span className="badge badge-green" style={{ fontSize: '0.8rem' }}>{perc}%</span>
                      </div>

                      <div className="meter" style={{ marginTop: 12 }}>
                        <div style={{ width: perc + '%' }} />
                      </div>

                      {daRegistrare > 0 && (
                        <div
                          onClick={() => navigate('/catechismo/presenze')}
                          style={{
                            marginTop: 13, padding: '10px 12px', borderRadius: 10,
                            background: 'var(--red-bg)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 9,
                          }}
                        >
                          <Icon name="presenze" size={17} style={{ color: 'var(--red)' }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#8f5641' }}>
                            {daRegistrare} {daRegistrare === 1 ? 'bambino' : 'bambini'} ancora da registrare
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {riepilogo.prossima && (
                    <div style={{
                      marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--gray-100)',
                      display: 'flex', alignItems: 'center', gap: 9,
                    }}>
                      <Icon name="date" size={17} style={{ color: 'var(--gray-500)' }} />
                      <span className="text-sm">
                        <strong>Prossimo incontro:</strong> {formattaData(riepilogo.prossima.data)}
                        {riepilogo.prossima.descrizione ? ' - ' + riepilogo.prossima.descrizione : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Numeri generali */}
          {isAdmin && stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              <StatCard num={stats.bambini} label="Bambini" color="var(--primary)" bg="var(--primary-bg)" onClick={() => navigate('/catechismo/bambini')} />
              <StatCard num={stats.classi}  label="Classi"  color="#4c6478"       bg="var(--blue-bg)"    onClick={() => navigate('/catechismo/classi')} />
              <StatCard num={stats.utenti}  label="Utenti"  color="#8f5641"       bg="var(--red-bg)"     onClick={() => navigate('/admin/utenti')} />
            </div>
          )}

          {/* Accesso rapido */}
          {shortcuts.length > 0 && (
            <>
              <div className="dash-label">Accesso rapido</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 9 }}>
                {shortcuts.map(s => (
                  <button
                    key={s.path}
                    onClick={() => navigate(s.path)}
                    style={{
                      background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 12,
                      padding: '15px 6px', textAlign: 'center', cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)', fontFamily: 'Nunito, sans-serif',
                    }}
                  >
                    <div style={{ marginBottom: 7, color: s.color, display: 'flex', justifyContent: 'center' }}>
                      <Icon name={s.icon} size={25} />
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── COLONNA LATERALE ───────────────────────── */}
        <div>

          {/* Prossimi appuntamenti */}
          <div className="dash-label">Prossimi appuntamenti</div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-body" style={{ padding: eventi.length ? '6px 16px' : 16 }}>
              {eventi.length === 0 ? (
                <div className="text-sm text-muted">Nessun appuntamento in programma.</div>
              ) : eventi.map((e, i) => {
                const d = new Date(e.data + 'T00:00:00')
                return (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0',
                    borderBottom: i < eventi.length - 1 ? '1px solid var(--gray-100)' : 'none',
                  }}>
                    <div style={{ width: 42, flexShrink: 0, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                        {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.1 }}>{d.getDate()}</div>
                    </div>
                    <div style={{ width: 3, height: 30, borderRadius: 99, background: e.colore || 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>{e.titolo}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        {e.ora_inizio ? e.ora_inizio.slice(0, 5) : ''}
                        {e.ora_inizio && e.luogo ? ' · ' : ''}
                        {e.luogo || ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Avvisi */}
          <div className="dash-label">Avvisi</div>
          {bacheca.length === 0 ? (
            <div className="card">
              <div className="card-body text-sm text-muted">Nessun avviso presente.</div>
            </div>
          ) : bacheca.map(a => (
            <div key={a.id} className="card" style={{ marginBottom: 10, borderLeft: '3px solid var(--primary)' }}>
              <div className="card-body">
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 3 }}>{a.titolo}</div>
                <div className="text-sm text-muted">{a.testo}</div>
                <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                  {new Date(a.created_at).toLocaleDateString('it-IT')} &middot; <span className="badge badge-green">{a.destinatari}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

function StatCard({ num, label, color, bg, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ background: bg, borderRadius: 12, padding: '14px 8px', textAlign: 'center', cursor: 'pointer' }}
    >
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: '0.66rem', color, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
