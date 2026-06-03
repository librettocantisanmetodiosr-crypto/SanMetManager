import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

export default function Coristi() {
  const { toast, ToastContainer } = useToast()
  const [coristi, setCoristi] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const { data } = await supabase.from('profili')
      .select('*')
      .in('ruolo', ['corista','responsabile_coro'])
      .eq('attivo', true)
      .order('cognome')
    setCoristi(data || [])
    setLoading(false)
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>🎤 Coristi</h1>
        <div className="text-sm text-muted">{coristi.length} totali</div>
      </div>
      <div style={{ background:'var(--blue-bg)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:'0.8rem', color:'var(--blue)' }}>
        Per aggiungere un corista: Supabase → Authentication → Invite user, poi assegna ruolo "corista" o "responsabile_coro".
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {coristi.map(c => (
            <div key={c.id} className="card">
              <div className="card-body" style={{ padding:'13px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:800 }}>{c.nome} {c.cognome}</div>
                  <div className="text-xs text-muted">@{c.username}</div>
                  {c.telefono && <div className="text-sm text-muted">📞 {c.telefono}</div>}
                </div>
                <span className={`badge ${c.ruolo === 'responsabile_coro' ? 'badge-gold' : 'badge-green'}`}>
                  {c.ruolo === 'responsabile_coro' ? 'Responsabile' : 'Corista'}
                </span>
              </div>
            </div>
          ))}
          {coristi.length === 0 && <div className="empty-state"><div className="icon">🎤</div><p>Nessun corista presente</p></div>}
        </div>
      )}
    </div>
  )
}