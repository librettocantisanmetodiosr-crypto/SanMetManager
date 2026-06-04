import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const { aggiornaPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [mostra, setMostra] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) return setErrore('La password deve essere di almeno 6 caratteri')
    if (password !== conferma) return setErrore('Le password non coincidono')
    setLoading(true)
    setErrore('')
    const { error } = await aggiornaPassword(password)
    if (error) {
      setErrore('Errore: ' + error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'url(/chiesa.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 40%' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'linear-gradient(160deg, rgba(7,82,50,0.88) 0%, rgba(20,50,100,0.82) 100%)' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 28, color: '#fff' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔑</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.08em' }}>
            Nuova Password
          </div>
          <div style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: 4 }}>
            Parrocchia San Metodio — Siracusa
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 20, padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
          <h2 style={{ marginBottom: 8, color: 'var(--gray-900)' }}>Imposta nuova password</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 20 }}>
            Scegli una password sicura di almeno 6 caratteri.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nuova password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostra ? 'text' : 'password'}
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setMostra(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--gray-500)' }}>
                  {mostra ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Conferma password</label>
              <input
                type={mostra ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={conferma}
                onChange={e => setConferma(e.target.value)}
                required
              />
            </div>
            {errore && (
              <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 14, fontWeight: 600 }}>
                ⚠️ {errore}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 8 }} disabled={loading}>
              {loading ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Salvataggio…</> : 'Salva password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
