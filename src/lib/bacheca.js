// Destinatari degli avvisi in bacheca.
// Nel database la colonna `destinatari` è un testo con i valori separati da virgola:
// gruppi ("catechisti,coro") e/o persone singole ("u:<id profilo>").
// "tutti" vuol dire visibile a chiunque abbia un account.

export const GRUPPI_BACHECA = [
  { id: 'tutti',           label: 'Tutti' },
  { id: 'catechisti',      label: 'Catechisti' },
  { id: 'segreteria',      label: 'Segreteria' },
  { id: 'comitato',        label: 'Comitato' },
  { id: 'coro',            label: 'Coro' },
  { id: 'neocatecumenali', label: 'Neocatecumenali' },
]

export const leggiDestinatari = (testo) =>
  String(testo || 'tutti').split(',').map(x => x.trim()).filter(Boolean)

export const scriviDestinatari = (valori) =>
  (valori.length ? valori : ['tutti']).join(',')

// Etichetta breve, es. "Catechisti · Coro · 2 persone"
export const etichettaDestinatari = (testo) => {
  const valori = leggiDestinatari(testo)
  const parti = valori
    .filter(v => !v.startsWith('u:'))
    .map(id => GRUPPI_BACHECA.find(g => g.id === id)?.label || id)
  const persone = valori.filter(v => v.startsWith('u:')).length
  if (persone) parti.push(persone === 1 ? '1 persona' : `${persone} persone`)
  return parti.join(' · ') || 'Tutti'
}
