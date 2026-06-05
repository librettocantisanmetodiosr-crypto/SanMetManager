import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        caricaProfilo(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        caricaProfilo(session.user.id)
      } else {
        setProfilo(null)
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
        console.error('Errore caricamento profilo:', error)
        if (error.code === 'PGRST116') {
          const { data: newProfilo } = await supabase
            .from('profili')
            .insert({ id: userId, username: 'utente', ruolo: 'catechista' })
            .select()
            .single()
          setProfilo(newProfilo)
        }
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

  const tuttiRuoli = profilo
    ? [profilo.ruolo, ...(profilo.ruoli_extra || [])].filter(Boolean)
    : []

  const hasRole = (r) => tuttiRuoli.includes(r)

  return (
    <AuthContext.Provider value={{ user, profilo, tuttiRuoli, hasRole, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
