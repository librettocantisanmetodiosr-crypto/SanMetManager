// ── EmailJS config ─────────────────────────────────────────────
// Istruzioni setup: vai su https://www.emailjs.com
// 1. Registrati gratis (200 email/mese)
// 2. Email Services → Add New Service → Gmail (connetti l'account della parrocchia)
// 3. Email Templates → crea i due template descritti sotto, copia gli ID qui
// 4. Account → API Keys → copia Public Key

export const EMAIL_CONFIG = {
  serviceId:  process.env.REACT_APP_EMAILJS_SERVICE_ID  || '',
  publicKey:  process.env.REACT_APP_EMAILJS_PUBLIC_KEY  || '',
  templates: {
    benvenuto: process.env.REACT_APP_EMAILJS_TPL_BENVENUTO || '',
    lettera:   process.env.REACT_APP_EMAILJS_TPL_LETTERA   || '',
  },
}

export const emailConfigured = () =>
  !!(EMAIL_CONFIG.serviceId && EMAIL_CONFIG.publicKey &&
     EMAIL_CONFIG.templates.benvenuto && EMAIL_CONFIG.templates.lettera)
