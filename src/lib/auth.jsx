import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        caricaProfilo(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setUser(session?.user ?? null)
        setLoading(false)
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) {
        caricaProfilo(session.user.id)
      } else {
        setProfilo(null)
        setRecoveryMode(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const caricaProfilo = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profili')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Profilo non trovato — ne crea uno base
          const { data: newProfilo, error: insertErr } = await supabase
            .from('profili')
            .insert({ id: userId, username: `utente_${userId.slice(0,6)}`, ruolo: 'catechista' })
            .select()
            .single()
          if (!insertErr) setProfilo(newProfilo)
        }
        // Qualsiasi altro errore: loading finisce e profilo resta null (utente vede pagina vuota)
      } else {
        setProfilo(data)
      }
    } catch (e) {
      console.error('Errore:', e)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setProfilo(null)
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://san-met-manager-dda9.vercel.app',
    })
    return { error }
  }

  const aggiornaPassword = async (nuovaPassword) => {
    const { error } = await supabase.auth.updateUser({ password: nuovaPassword })
    if (!error) setRecoveryMode(false)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, profilo, loading, recoveryMode, login, logout, resetPassword, aggiornaPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
