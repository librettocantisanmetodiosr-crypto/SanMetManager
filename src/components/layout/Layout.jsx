import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const SEZIONI = [
  {
    key: 'catechismo', label: 'Catechismo', icon: '📚', color: 'var(--primary)',
    ruoli: ['admin','parroco','segreteria','catechista','responsabile'],
    voci: [
      { path: '/catechismo/presenze',  label: 'Presenze',  icon: '✅' },
      { path: '/catechismo/bambini',   label: 'Bambini',   icon: '👦' },
      { path: '/catechismo/classi',    label: 'Classi',    icon: '🏫' },
      { path: '/catechismo/report',    label: 'Report',    icon: '📊' },
      { path: '/catechismo/date',      label: 'Date',      icon: '📅', ruoli: ['admin','parroco','segreteria','responsabile'] },
      { path: '/catechismo/supplenze', label: 'Supplenze', icon: '🔄', ruoli: ['admin','parroco','segreteria','responsabile'] },
      { path: '/bacheca',              label: 'Bacheca',   icon: '📌' },
    ]
  },
  {
    key: 'comitato', label: 'Comitato', icon: '📋', color: 'var(--blue)',
    ruoli: ['admin','parroco','comitato','responsabile'],
    voci: [
      { path: '/comitato/calendario', label: 'Calendario', icon: '🗓️' },
      { path: '/comitato/lettere',    label: 'Lettere',    icon: '📄' },
      { path: '/comitato/rubrica',    label: 'Rubrica',    icon: '📇' },
    ]
  },
  {
    key: 'coro', label: 'Coro', icon: '🎵', color: 'var(--gold)',
    ruoli: ['admin','parroco','responsabile_coro','corista','neocatecumenale','responsabile_neo','comitato','segreteria','catechista','responsabile'],
    voci: [
      { path: '/coro/canti',   label: 'Canti',   icon: '🎶' },
      { path: '/coro/coristi', label: 'Coristi', icon: '🎤', ruoli: ['admin','parroco','responsabile_coro','responsabile'] },
    ]
  },
  {
    key: 'neo', label: 'Neocatec.', icon: '✝️', color: 'var(--red)',
    ruoli: ['admin','parroco','neocatecumenale','responsabile_neo','responsabile'],
    voci: [
      { path: '/neo/comunita', label: 'Comunità', icon: '🕊️' },
      { path: '/neo/stanze',   label: 'Stanze',   icon: '🚪' },
      { path: '/neo/avvisi',   label: 'Avvisi',   icon: '📢' },
    ]
  },
  {
    key: 'admin', label: 'Amministrazione', icon: '⚙️', color: 'var(--gray-700)',
    ruoli: ['admin','parroco','segreteria','responsabile'],
    voci: [
      { path: '/admin/utenti', label: 'Utenti', icon: '👤' },
    ]
  },
]

export default function Layout() {
  const { profilo, tuttiRuoli, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const canSee = (ruoli) => {
    if (!ruoli) return true
    if (['admin', 'parroco', 'responsabile'].some(r => tuttiRuoli.includes(r))) return true
    return ruoli.some(r => tuttiRuoli.includes(r))
  }

  const sezioniVisibili = SEZIONI.filter(s => canSee(s.ruoli))

  const sezioneCorrente = SEZIONI.find(s =>
    s.voci.some(v => location.pathname.startsWith(v.path))
  )

  // Sezione espansa nel drawer: segue la navigazione corrente
  const [activeSection, setActiveSection] = useState(sezioneCorrente?.key ?? null)
  useEffect(() => {
    if (sezioneCorrente) setActiveSection(sezioneCorrente.key)
  }, [location.pathname])

  // Chiudi drawer con Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    if (drawerOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const apriSezione = (key) => {
    setActiveSection(activeSection === key ? null : key)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initiali = profilo
    ? `${profilo.nome?.[0] ?? ''}${profilo.cognome?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  const nomeCompleto = profilo ? `${profilo.nome || ''} ${profilo.cognome || ''}`.trim() : 'Caricamento...'

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--gray-50)' }}>

      {/* TOP BAR */}
      <header style={{
        background:'#fff', borderBottom:'1px solid var(--gray-200)',
        padding:'12px 16px', display:'flex', alignItems:'center',
        justifyContent:'space-between', position:'sticky', top:0, zIndex:100,
        boxShadow:'var(--shadow-sm)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setDrawerOpen(true)} style={{ fontSize:'1.2rem' }}>☰</button>
          <div>
            <div style={{ fontFamily:'Cinzel, serif', fontSize:'0.9rem', fontWeight:600, color:'var(--primary)', lineHeight:1 }}>
              SanMetManager
            </div>
            <div style={{ fontSize:'0.68rem', color:'var(--gray-500)' }}>
              {sezioneCorrente ? sezioneCorrente.label : 'Dashboard'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavLink to="/bacheca">
            <button className="btn btn-ghost btn-icon">📌</button>
          </NavLink>
          <div
            onClick={() => setDrawerOpen(true)}
            style={{
              width:36, height:36, borderRadius:'50%',
              background:'var(--primary)', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.8rem', fontWeight:800, cursor:'pointer', flexShrink:0
            }}
          >{initiali}</div>
        </div>
      </header>

      {/* DRAWER */}
      {drawerOpen && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              position:'absolute', left:0, top:0, bottom:0, width:280,
              background:'#fff', overflowY:'auto', boxShadow:'var(--shadow-lg)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Profilo */}
            <div style={{ background:'var(--primary)', padding:'24px 20px 20px', color:'#fff' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', fontWeight:800, marginBottom:10, flexShrink:0 }}>{initiali}</div>
              <div style={{ fontWeight:800, fontSize:'1rem' }}>{nomeCompleto}</div>
              <div style={{ fontSize:'0.78rem', opacity:0.8, marginTop:2 }}>@{profilo?.username || '...'}</div>
              <div style={{ marginTop:6 }}>
                <span style={{ background:'rgba(255,255,255,0.2)', padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700 }}>
                  {(profilo?.ruolo || '...').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Voci menu */}
            <div style={{ padding:'8px 0' }}>
              <DrawerLink to="/" icon="🏠" label="Dashboard" onClick={() => setDrawerOpen(false)} />

              {sezioniVisibili.map(sezione => (
                <div key={sezione.key}>
                  <div
                    onClick={() => apriSezione(sezione.key)}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'12px 20px', cursor:'pointer', fontWeight:700, fontSize:'0.9rem',
                      color:'var(--gray-700)',
                      borderLeft:`3px solid ${activeSection === sezione.key ? sezione.color : 'transparent'}`,
                      background: activeSection === sezione.key ? 'var(--gray-50)' : 'transparent'
                    }}
                  >
                    <span>{sezione.icon} {sezione.label}</span>
                    <span style={{ fontSize:'0.7rem', color:'var(--gray-400)' }}>
                      {activeSection === sezione.key ? '▲' : '▼'}
                    </span>
                  </div>
                  {activeSection === sezione.key && sezione.voci.filter(v => canSee(v.ruoli)).map(v => (
                    <DrawerLink
                      key={v.path} to={v.path} icon={v.icon} label={v.label}
                      indent onClick={() => setDrawerOpen(false)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Logout */}
            <div style={{ padding:'8px 0', borderTop:'1px solid var(--gray-200)', marginTop:8 }}>
              <div
                onClick={handleLogout}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', cursor:'pointer', color:'var(--red)', fontWeight:700, fontSize:'0.9rem' }}
              >
                <span>🚪</span> Esci
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENUTO PAGINA */}
      <main style={{ flex:1, paddingBottom:80 }}>
        <Outlet />
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'#fff', borderTop:'1px solid var(--gray-200)',
        display:'flex', boxShadow:'0 -2px 10px rgba(0,0,0,0.06)',
        zIndex:100, paddingBottom:'env(safe-area-inset-bottom)'
      }}>
        <BottomTab to="/" icon="🏠" label="Home" exact />
        {sezioniVisibili.slice(0,3).map(s => (
          <BottomTab
            key={s.key}
            to={s.voci.filter(v => canSee(v.ruoli))[0]?.path ?? '/'}
            icon={s.icon}
            label={s.label}
            color={s.color}
          />
        ))}
        <BottomTab to="#" icon="☰" label="Menu" onClick={(e) => { e.preventDefault(); setDrawerOpen(true) }} />
      </nav>
    </div>
  )
}

function DrawerLink({ to, icon, label, indent, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={({ isActive }) => ({
        display:'flex', alignItems:'center', gap:12,
        padding: indent ? '10px 20px 10px 44px' : '12px 20px',
        color: isActive ? 'var(--primary)' : 'var(--gray-700)',
        background: isActive ? 'var(--primary-bg)' : 'transparent',
        fontWeight: isActive ? 700 : 600, fontSize:'0.88rem',
        textDecoration:'none',
        borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent'
      })}
    >
      <span>{icon}</span>{label}
    </NavLink>
  )
}

function BottomTab({ to, icon, label, exact, color, onClick }) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      style={({ isActive }) => ({
        flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'8px 4px 6px', textDecoration:'none',
        color: isActive ? (color || 'var(--primary)') : 'var(--gray-400)',
        fontSize:'0.6rem', fontWeight:700, gap:3, transition:'color 0.15s',
        borderTop: isActive ? `2px solid ${color || 'var(--primary)'}` : '2px solid transparent',
      })}
    >
      <span style={{ fontSize:'1.25rem' }}>{icon}</span>
      {label}
    </NavLink>
  )
}
