import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { profilo, tuttiRuoli } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [bacheca, setBacheca] = useState([])

  const isAdmin = ['admin','parroco','segreteria'].some(r => tuttiRuoli.includes(r))
  const hasCatechismo = ['admin','parroco','segreteria','catechista','responsabile'].some(r => tuttiRuoli.includes(r))
  const hasComitato = ['admin','parroco','comitato','responsabile_comitato'].some(r => tuttiRuoli.includes(r))
  const hasComitaEdit = ['admin','parroco','responsabile_comitato'].some(r => tuttiRuoli.includes(r))
  const hasCoro = ['admin','parroco','responsabile_coro','corista'].some(r => tuttiRuoli.includes(r))
  const hasNeo = ['admin','parroco','neocatecumenale','responsabile_neo'].some(r => tuttiRuoli.includes(r))

  useEffect(() => {
    if (!profilo) return
    caricaBacheca()
    if (isAdmin) caricaStats()
  }, [profilo])

  const caricaStats = async () => {
    const [{ count: bambini }, { count: classi }, { count: utenti }] = await Promise.all([
      supabase.from('bambini').select('*', { count: 'exact', head: true }).eq('attivo', true),
      supabase.from('classi').select('*', { count: 'exact', head: true }).eq('attiva', true),
      supabase.from('profili').select('*', { count: 'exact', head: true }).eq('attivo', true),
    ])
    setStats({ bambini: bambini || 0, classi: classi || 0, utenti: utenti || 0 })
  }

  const caricaBacheca = async () => {
    const { data } = await supabase
      .from('bacheca').select('id, titolo, testo, destinatari, created_at')
      .eq('attivo', true).order('created_at', { ascending: false }).limit(4)
    setBacheca(data || [])
  }

  const ora = new Date().getHours()
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'

  const shortcuts = [
    hasCatechismo && { icon: '✅', label: 'Presenze', path: '/catechismo/presenze', color: 'var(--primary)' },
    hasCatechismo && { icon: '👦', label: 'Bambini', path: '/catechismo/bambini', color: 'var(--primary)' },
    isAdmin        && { icon: '🏫', label: 'Classi', path: '/catechismo/classi', color: 'var(--primary)' },
    hasComitato    && { icon: '🗓️', label: 'Calendario', path: '/comitato/calendario', color: 'var(--blue)' },
    hasComitaEdit  && { icon: '📄', label: 'Lettere', path: '/comitato/lettere', color: 'var(--blue)' },
    hasCoro        && { icon: '🎵', label: 'Canti', path: '/coro/canti', color: 'var(--gold)' },
    hasNeo         && { icon: '🚪', label: 'Stanze', path: '/neo/stanze', color: 'var(--red)' },
    isAdmin        && { icon: '👤', label: 'Utenti', path: '/admin/utenti', color: 'var(--gray-700)' },
  ].filter(Boolean)

  return (
    <div style={{ padding: 16 }}>

      {/* Greeting con sfondo chiesa */}
      <div style={{
        borderRadius: 16, marginBottom: 20, overflow: 'hidden',
        position: 'relative', minHeight: 120,
        backgroundImage: 'url(/chiesa-drone.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center 55%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(7,82,50,0.82) 0%, rgba(20,50,100,0.75) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '22px 20px', color: '#fff' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 3 }}>
            {saluto}, {profilo?.nome || 'benvenuto'}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Stats admin */}
      {isAdmin && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard num={stats.bambini} label="Bambini" color="var(--primary)" bg="var(--primary-bg)" onClick={() => navigate('/catechismo/bambini')} />
          <StatCard num={stats.classi}  label="Classi"  color="var(--blue)"    bg="var(--blue-bg)"    onClick={() => navigate('/catechismo/classi')} />
          <StatCard num={stats.utenti}  label="Utenti"  color="var(--red)"     bg="var(--red-bg)"     onClick={() => navigate('/catechismo/utenti')} />
        </div>
      )}

      {/* Accesso rapido */}
      {shortcuts.length > 0 && (
        <>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-500)', marginBottom: 10 }}>
            Accesso rapido
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
            {shortcuts.map(s => (
              <button
                key={s.path}
                onClick={() => navigate(s.path)}
                style={{
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '14px 6px', textAlign: 'center', cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'transform 0.12s',
                }}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
                onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bacheca */}
      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gray-500)', marginBottom: 10 }}>
        Avvisi
      </div>
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
              {new Date(a.created_at).toLocaleDateString('it-IT')} · <span className="badge badge-green">{a.destinatari}</span>
            </div>
          </div>
        </div>
      ))}
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
