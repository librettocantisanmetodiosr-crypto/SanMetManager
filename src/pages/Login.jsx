import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrore('')

    let email = form.identifier.trim()

    // Se non contiene @, è uno username — cerca l'email associata
    if (!email.includes('@')) {
      const { data, error: rpcErr } = await supabase.rpc('get_email_by_username', { p_username: email.toLowerCase() })
      if (rpcErr || !data) {
        setErrore('Username non trovato. Prova con la tua email.')
        setLoading(false)
        return
      }
      email = data
    }

    const { error } = await login(email, form.password)
    if (error) {
      setErrore('Credenziali non corrette.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      {/* Sfondo chiesa */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'url(/chiesa.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
      }} />
      {/* Overlay sfumato */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(160deg, rgba(7,82,50,0.88) 0%, rgba(20,50,100,0.82) 100%)',
      }} />

      {/* Contenuto */}
      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 2 }}>

        {/* Logo e titolo */}
        <div style={{ textAlign: 'center', marginBottom: 28, color: '#fff' }}>
          <img
            src="/logo-comitato.png"
            alt="Comitato San Metodio"
            style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 10, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
            onError={e => { e.currentTarget.style.display = 'none'; document.getElementById('login-icon').style.display = 'block' }}
          />
          <div id="login-icon" style={{ display: 'none', fontSize: '3.5rem', marginBottom: 8 }}>✝️</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.08em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            SanMetManager
          </div>
          <div style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: 4 }}>
            Parrocchia San Metodio — Siracusa
          </div>
        </div>

        {/* Card login */}
        <div style={{
          background: 'rgba(255,255,255,0.97)', borderRadius: 20, padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
        }}>
          <h2 style={{ marginBottom: 20, color: 'var(--gray-900)' }}>Accedi</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email o Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="email@esempio.it oppure nome.utente"
                value={form.identifier}
                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                required
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            {errore && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 14, fontWeight: 600 }}>
                ⚠️ {errore}
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 8 }}
              disabled={loading}
            >
              {loading ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Accesso…</> : 'Accedi'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
          Per problemi di accesso contatta l'amministratore
        </div>
      </div>
    </div>
  )
}
