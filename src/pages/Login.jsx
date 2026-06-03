import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrore('')
    const { error } = await login(form.email, form.password)
    if (error) {
      setErrore('Email o password non corretti.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(160deg, var(--primary) 0%, #0d4a29 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>✝️</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.08em' }}>
            SanMetManager
          </div>
          <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: 4 }}>
            Parrocchia San Metodio — Siracusa
          </div>
        </div>

        {/* Card login */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
        }}>
          <h2 style={{ marginBottom: 20, color: 'var(--gray-900)' }}>Accedi</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="nome@esempio.it"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoCapitalize="none"
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

        <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
          Per problemi di accesso contatta l'amministratore
        </div>
      </div>
    </div>
  )
}
