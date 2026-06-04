import emailjs from '@emailjs/browser'
import { EMAIL_CONFIG } from './emailConfig'

let initialized = false

const init = () => {
  if (!initialized && EMAIL_CONFIG.publicKey) {
    emailjs.init({ publicKey: EMAIL_CONFIG.publicKey })
    initialized = true
  }
}

export const inviaBenvenuto = async ({ nome, cognome, email, password, ruolo }) => {
  init()
  return emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templates.benvenuto, {
    nome_completo: `${nome} ${cognome}`,
    email_utente: email,
    password_temp: password,
    ruolo_label: ruolo,
    app_link: 'https://san-met-manager-dda9.vercel.app',
  })
}

export const inviaLettera = async ({ emailDest, oggetto, testo }) => {
  init()
  return emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templates.lettera, {
    to_email: emailDest,
    oggetto,
    testo_lettera: testo,
  })
}
