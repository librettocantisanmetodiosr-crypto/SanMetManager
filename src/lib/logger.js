import { supabase } from './supabase'

export async function logAzione(azione, dettaglio = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('log_attivita').insert({ utente_id: user.id, azione, dettaglio })
  } catch (_) { /* silent */ }
}
