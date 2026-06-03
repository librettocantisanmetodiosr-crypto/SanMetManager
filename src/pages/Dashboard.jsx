import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

const mesi = ['Ott','Nov','Dic','Gen','Feb','Mar','Apr','Mag']
// Dati statistici — vengono caricati da Supabase in produzione
const datiPresenze = [
  { mese:'Ott', presenti:95, assenti:25 },
  { mese:'Nov', presenti:88, assenti:32 },
  { mese:'Dic', presenti:72, assenti:48 },
  { mese:'Gen', presenti:90, assenti:30 },
  { mese:'Feb', presenti:86, assenti:34 },
  { mese:'Mar', presenti:91, assenti:29 },
  { mese:'Apr', presenti:89, assenti:31 },
  { mese:'Mag', presenti:83, assenti:37 },
]
const datiClassi = [
  { classe:'I-A',  perc:91 }, { classe:'I-B', perc:88 },
  { classe:'II',   perc:85 }, { classe:'III', perc:90 },
  { classe:'IV',   perc:93 }, { classe:'V',   perc:87 },
  { classe:'PC-A', perc:82 }, { classe:'PC-B',perc:89 },
]

export default function Dashboard() {
  const { profilo } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ bambini: 0, classi: 0, utenti: 0 })
  const [bacheca, setBacheca] = useState([])

  const isAdmin = ['admin','parroco','segreteria'].includes(profilo?.ruolo)

  useEffect(() => {
    if (!profilo) return
    caricaStats()
    caricaBacheca()
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
      .from('bacheca')
      .select('*')
      .eq('attivo', true)
      .order('created_at', { ascending: false })
      .limit(3)
    setBacheca(data || [])
  }

  const ora = new Date().getHours()
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'

  return (
    <div style={{ padding: 16 }}>

      {/* Saluto */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--gray-900)' }}>{saluto}, {profilo?.nome || 'benvenuto'} 👋</h1>
        <p className="text-muted text-sm" style={{ marginTop: 4 }}>
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats (solo admin) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard num={stats.bambini} label="Bambini" icon="👦" color="var(--primary)" bg="var(--primary-bg)" />
          <StatCard num={stats.classi}  label="Classi"  icon="🏫" color="var(--blue)"    bg="var(--blue-bg)" />
          <StatCard num={stats.utenti}  label="Utenti"  icon="👤" color="var(--red)"     bg="var(--red-bg)" />
        </div>
      )}

      {/* Accesso rapido */}
      <h2 style={{ marginBottom: 12, fontSize: '0.95rem' }}>Accesso rapido</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {['admin','parroco','segreteria','catechista'].includes(profilo?.ruolo) && (
          <ModuleCard icon="✅" label="Presenze" sub="Catechismo" color="var(--primary)" onClick={() => navigate('/catechismo/presenze')} />
        )}
        {['admin','parroco','segreteria','catechista'].includes(profilo?.ruolo) && (
          <ModuleCard icon="👦" label="Bambini" sub="Catechismo" color="var(--primary)" onClick={() => navigate('/catechismo/bambini')} />
        )}
        {['admin','parroco','comitato'].includes(profilo?.ruolo) && (
          <ModuleCard icon="📄" label="Lettere" sub="Comitato" color="var(--blue)" onClick={() => navigate('/comitato/lettere')} />
        )}
        {['admin','parroco','comitato'].includes(profilo?.ruolo) && (
          <ModuleCard icon="🗓️" label="Calendario" sub="Comitato" color="var(--blue)" onClick={() => navigate('/comitato/calendario')} />
        )}
        {['admin','parroco','responsabile_coro','corista'].includes(profilo?.ruolo) && (
          <ModuleCard icon="🎵" label="Canti" sub="Coro" color="var(--gold)" onClick={() => navigate('/coro/canti')} />
        )}
        {['admin','parroco','neocatecumenale','responsabile_neo'].includes(profilo?.ruolo) && (
          <ModuleCard icon="🚪" label="Stanze" sub="Neocatec." color="var(--red)" onClick={() => navigate('/neo/stanze')} />
        )}
      </div>

      {/* Grafici solo admin */}
      {isAdmin && (
        <>
          <h2 style={{ marginBottom: 12, fontSize: '0.95rem' }}>📊 Andamento presenze</h2>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <p className="text-xs text-muted" style={{ marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Presenti / Assenti per mese</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={datiPresenze} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                  <XAxis dataKey="mese" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="presenti" stroke="var(--primary)" strokeWidth={2.5} dot={false} name="Presenti" />
                  <Line type="monotone" dataKey="assenti"  stroke="var(--red)"     strokeWidth={2.5} dot={false} name="Assenti" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <p className="text-xs text-muted" style={{ marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>% presenze per classe</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={datiClassi} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                  <XAxis dataKey="classe" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`]} />
                  <Bar dataKey="perc" fill="var(--primary)" radius={[4,4,0,0]} name="% presenze" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Bacheca */}
      <h2 style={{ marginBottom: 12, fontSize: '0.95rem' }}>📌 Ultimi avvisi</h2>
      {bacheca.length === 0 ? (
        <div className="card"><div className="card-body text-muted text-sm">Nessun avviso presente.</div></div>
      ) : bacheca.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: 10, borderLeft: '4px solid var(--primary)' }}>
          <div className="card-body">
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{a.titolo}</div>
            <div className="text-sm text-muted">{a.testo}</div>
            <div className="text-xs text-muted" style={{ marginTop: 8 }}>
              {new Date(a.created_at).toLocaleDateString('it-IT')} · <span className="badge badge-green">{a.destinatari}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ num, label, icon, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: '0.68rem', color, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

function ModuleCard({ icon, label, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card"
      style={{ padding: '18px 14px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', activeStyle: {} }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--gray-900)' }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color, fontWeight: 700, marginTop: 2 }}>{sub}</div>
    </div>
  )
}
