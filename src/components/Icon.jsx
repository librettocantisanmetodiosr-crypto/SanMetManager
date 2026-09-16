// Set di icone disegnate (SVG) che sostituisce le emoji.
// Uso:  <Icon name="presenze" />  oppure  <Icon name="coro" size={22} />
// Il colore si eredita dal testo (currentColor), quindi l'icona si tinge
// da sola come la voce di menu in cui sta.

const P = {
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>,

  // Catechismo
  catechismo: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
  presenze: <><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M8 12.5l2.8 2.8L16 10" /></>,
  bambini: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 11.5a2.7 2.7 0 1 0 0-5.4" /><path d="M17.5 20c0-2.6-.9-4.3-2.3-5.2" /></>,
  diario: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 9.5h7M8 13h7M8 16.5h4" /></>,
  classi: <><path d="M3 20h18" /><path d="M5 20V9.5l7-4.5 7 4.5V20" /><path d="M10 20v-4.5h4V20" /><path d="M9.5 12h5" /></>,
  report: <><path d="M4 20h16" /><rect x="6" y="11" width="3.2" height="6" rx="1" /><rect x="11.4" y="7" width="3.2" height="10" rx="1" /><rect x="16.8" y="13.5" width="3.2" height="3.5" rx="1" /></>,
  date: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  supplenze: <><path d="M4 8h12l-3-3" /><path d="M20 16H8l3 3" /></>,
  bacheca: <><path d="M9 3h6l-.8 5.5 3.3 3.2H6.5l3.3-3.2z" /><path d="M12 11.7V21" /></>,

  // Comitato
  comitato: <><rect x="5" y="4.5" width="14" height="16" rx="2.2" /><path d="M9.5 3h5v3h-5z" /><path d="M9 11.5h6M9 15h4" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M7.5 13.5h2.5M7.5 17h2.5M14 13.5h2.5" /></>,
  lettere: <><path d="M6 3.5h7.5L19 9v11.5H6z" /><path d="M13 3.5V9h5.5" /><path d="M9 13h7M9 16.5h5" /></>,
  rubrica: <><rect x="5.5" y="3.5" width="13" height="17" rx="2.2" /><path d="M3.5 8h2M3.5 12h2M3.5 16h2" /><circle cx="12" cy="10.5" r="2.3" /><path d="M8.6 17c0-1.9 1.5-3.2 3.4-3.2s3.4 1.3 3.4 3.2" /></>,

  // Coro
  coro: <><circle cx="7" cy="18" r="2.6" /><circle cx="18" cy="15.5" r="2.6" /><path d="M9.6 18V7l10.8-2.2v10.7" /></>,
  canti: <><circle cx="7" cy="18" r="2.6" /><circle cx="18" cy="15.5" r="2.6" /><path d="M9.6 18V7l10.8-2.2v10.7" /></>,
  scalette: <><path d="M4 7h9M4 12h9M4 17h6" /><circle cx="17.5" cy="16.5" r="2.2" /><path d="M19.7 16.5V7.5l1.8-.5" /></>,
  coristi: <><rect x="9.5" y="3" width="5" height="10" rx="2.5" /><path d="M6 11.5a6 6 0 0 0 12 0" /><path d="M12 17.5V21M9 21h6" /></>,

  // Neocatecumenali
  neocatecumenali: <><path d="M12 3v18M7.5 8h9" /><path d="M12 21c-3.5-2-5.5-5-5.5-8.5" /><path d="M12 21c3.5-2 5.5-5 5.5-8.5" /></>,
  comunita: <><circle cx="8.5" cy="9" r="2.8" /><circle cx="16" cy="10" r="2.3" /><path d="M3.5 19c0-3 2.2-5 5-5s5 2 5 5" /><path d="M15 14.2c2.6 0 4.5 1.8 4.5 4.3" /></>,
  stanze: <><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h9A1.5 1.5 0 0 1 17 5.5V20" /><path d="M3.5 20h17" /><circle cx="14" cy="12.5" r="1" /></>,
  avvisi: <><path d="M3.5 10.5v3l3 .5 3.5 4.5V5.5L6.5 10z" /><path d="M13.5 8.5a5 5 0 0 1 0 7" /><path d="M16.5 6a8.5 8.5 0 0 1 0 12" /></>,

  // Amministrazione
  amministrazione: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h7M15 17h5" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="13" cy="17" r="2" /></>,
  utenti: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  attivita: <><rect x="5" y="4.5" width="14" height="16" rx="2.2" /><path d="M9.5 3h5v3h-5z" /><path d="M9 11.5l1.4 1.4 2.6-2.6M9 16l1.4 1.4 2.6-2.6" /></>,

  // Interfaccia
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  giu: <><path d="M6 9.5l6 6 6-6" /></>,
  su: <><path d="M6 14.5l6-6 6 6" /></>,
  esci: <><path d="M9.5 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4" /><path d="M16 16.5l4.5-4.5L16 7.5" /><path d="M20.5 12H9.5" /></>,
}

export default function Icon({ name, size = 20, strokeWidth = 1.7, style }) {
  const d = P[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      style={{ flexShrink: 0, ...style }}
    >{d}</svg>
  )
}
