import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Controlla sessione esistente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) caricaProfilo(session.user.id)
      else setLoading(false)
    })

    // Ascolta cambiamenti auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) caricaProfilo(session.user.id)
      else { setProfilo(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const caricaProfilo = async (userId) => {
    const { data } = await supabase
      .from('profili')
      .select('*')
      .eq('id', userId)
      .single()
    setProfilo(data)
    setLoading(false)
  }

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setProfilo(null)
  }

  return (
    <AuthContext.Provider value={{ user, profilo, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
