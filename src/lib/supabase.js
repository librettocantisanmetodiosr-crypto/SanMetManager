import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Ruoli disponibili nel sistema
export const RUOLI = {
  ADMIN: 'admin',
  PARROCO: 'parroco',
  SEGRETERIA: 'segreteria',
  CATECHISTA: 'catechista',
  COMITATO: 'comitato',
  CORISTA: 'corista',
  RESPONSABILE_CORO: 'responsabile_coro',
  NEOCATECUMENALE: 'neocatecumenale',
  RESPONSABILE_NEO: 'responsabile_neo',
}

// Permessi per sezione
export const PERMESSI = {
  catechismo: [RUOLI.ADMIN, RUOLI.PARROCO, RUOLI.SEGRETERIA, RUOLI.CATECHISTA],
  comitato: [RUOLI.ADMIN, RUOLI.PARROCO, RUOLI.COMITATO],
  coro: [RUOLI.ADMIN, RUOLI.PARROCO, RUOLI.CORISTA, RUOLI.RESPONSABILE_CORO],
  neocatecumenali: [RUOLI.ADMIN, RUOLI.PARROCO, RUOLI.NEOCATECUMENALE, RUOLI.RESPONSABILE_NEO],
  admin: [RUOLI.ADMIN],
}

export const canAccess = (ruolo, sezione) => {
  return PERMESSI[sezione]?.includes(ruolo) ?? false
}

export const isAdmin = (ruolo) => ruolo === RUOLI.ADMIN || ruolo === RUOLI.PARROCO
