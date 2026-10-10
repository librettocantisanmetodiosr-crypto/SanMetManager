// Lettura gratuita di un elenco di bambini da foto o PDF, fatta nel browser
// (Tesseract + pdf.js, gia' presenti nell'app): non usa servizi a pagamento.
// E' meno precisa di una lettura con Claude e non capisce la scrittura a mano,
// quindi ogni riga dubbia viene segnalata e l'elenco va sempre ricontrollato.

const LATO = 3600   // lato lungo dell'immagine data in pasto al lettore

// ── 1. Pulizia dell'immagine ─────────────────────────────────
// Da grigi a bianco e nero confrontando ogni punto con lo sfondo attorno
// (cosi' ombre e pieghe non contano), poi via le righe della tabella: le
// linee attaccate alle lettere sono cio' che piu' confonde il lettore.
export function pulisciImmagine(grigi, w, h) {
  const B = 24
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B)
  const somma = new Float64Array(gw * gh), conta = new Uint32Array(gw * gh)
  for (let y = 0; y < h; y++) {
    const gy = (y / B) | 0
    for (let x = 0; x < w; x++) {
      const i = gy * gw + ((x / B) | 0)
      somma[i] += grigi[y * w + x]; conta[i]++
    }
  }
  const sfondo = new Float32Array(gw * gh)
  for (let i = 0; i < sfondo.length; i++) sfondo[i] = somma[i] / conta[i]

  const nero = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, y / B - 0.5))
    const y0 = fy | 0, y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, x / B - 0.5))
      const x0 = fx | 0, x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0
      const s = (sfondo[y0 * gw + x0] * (1 - tx) + sfondo[y0 * gw + x1] * tx) * (1 - ty)
              + (sfondo[y1 * gw + x0] * (1 - tx) + sfondo[y1 * gw + x1] * tx) * ty
      if (s - grigi[y * w + x] > 26) nero[y * w + x] = 1
    }
  }

  // tratti continui piu' lunghi di una lettera = righe della tabella
  const L = Math.round(Math.max(w, h) * 0.0175)
  const via = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    let inizio = -1
    for (let x = 0; x <= w; x++) {
      const pieno = x < w && nero[y * w + x]
      if (pieno && inizio < 0) inizio = x
      else if (!pieno && inizio >= 0) {
        if (x - inizio >= L) for (let k = inizio; k < x; k++) via[y * w + k] = 1
        inizio = -1
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let inizio = -1
    for (let y = 0; y <= h; y++) {
      const pieno = y < h && nero[y * w + x]
      if (pieno && inizio < 0) inizio = y
      else if (!pieno && inizio >= 0) {
        if (y - inizio >= L) for (let k = inizio; k < y; k++) via[k * w + x] = 1
        inizio = -1
      }
    }
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = nero[i] && !via[i] ? 0 : 255
  return out
}

// ── 2. Dal testo letto alle righe dei bambini ────────────────
const RE_DATA = /(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*((?:19|20)\d{2})/
const RE_TEL = /(\d{3})\s*[-/. ]?\s*(\d{6,7})(?!\d)/g
const RE_VIA = /\b(VIA|VIALE|V\.LE|PIAZZA|P\.ZZA|TRAV|CORSO|C\.SO|RONCO|LARGO|CONTRADA|C\.DA|VICOLO)\b/i
const PREFISSI = ['DI', 'DE', 'DEL', 'DELLA', 'DELLO', 'DEI', 'DA', 'DAL', 'LA', 'LO', 'LI', 'LE', 'SAN', 'SANTA']
const PAROLA_OK = /^(\p{Lu}[\p{Lu}']*|\p{Lu}\p{Ll}[\p{Ll}']*)$/u

function nomiDa(segmento) {
  // una riga barrata a penna viene letta come una serie di lineette in mezzo al nome
  const barrato = /[—–]|__/.test(segmento)
  const parole = segmento
    .replace(/[^\p{L}'’\s]/gu, ' ')
    .split(/\s+/)
    .map(p => p.replace(/’/g, "'").replace(/^'+|'+$/g, ''))
    // via i frammenti: lettere isolate e sigle senza vocali ("PP", "TT")
    .filter(p => p.length > 1 && (p.length > 3 || /[aeiouàèéìòù]/i.test(p)))
  const strano = parole.some(p => !PAROLA_OK.test(p))
  let cognome = parole[0] || '', resto = parole.slice(1)
  if (resto.length >= 2 && PREFISSI.includes(cognome.toUpperCase())) {
    cognome = `${cognome} ${resto[0]}`; resto = resto.slice(1)
  }
  return { cognome, nome: resto.join(' '), barrato, strano: strano || parole.length < 2 }
}

export function righeDaTesto(testo) {
  const out = []
  for (const riga of String(testo || '').split(/\r?\n/)) {
    const d = riga.match(RE_DATA)
    let prima, dopo, data = ''
    if (d && Number(d[1]) >= 1 && Number(d[1]) <= 31 && Number(d[2]) >= 1 && Number(d[2]) <= 12) {
      prima = riga.slice(0, d.index); dopo = riga.slice(d.index + d[0].length)
      data = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
    } else {
      // niente data leggibile: tengo la riga solo se ha un indirizzo e un telefono
      const v = riga.match(RE_VIA)
      if (!v || !riga.slice(v.index).match(RE_TEL)) continue
      prima = riga.slice(0, v.index); dopo = riga.slice(v.index)
    }
    const { cognome, nome, barrato, strano } = nomiDa(prima)
    if (!cognome) continue

    const tel = [...dopo.matchAll(RE_TEL)].pop()
    const telefono = tel ? `${tel[1]}-${tel[2]}` : ''
    const indirizzo = (tel ? dopo.slice(0, tel.index) : dopo)
      .replace(/[|[\]{}_—–=~‘’'"!\\]/g, ' ').replace(/\s+/g, ' ').replace(/^[^\p{L}\d]+|[^\p{L}\d.]+$/gu, '')

    const dubbi = []
    if (barrato) dubbi.push('sembra cancellato a penna')
    else if (strano) dubbi.push('nome letto male')
    if (!data) dubbi.push('data non letta')
    if (!telefono) dubbi.push('telefono non letto')
    out.push({
      cognome, nome, data_nascita: data, indirizzo, telefono,
      cancellato: barrato, incerto: !barrato && dubbi.length > 0, nota: dubbi.join(', '),
    })
  }
  return out
}

// ── 3. Parte che gira nel browser ────────────────────────────
const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

// Disegna la sorgente ruotata di 0/90/180/270 gradi e portata alla misura giusta
function ruotata(sorgente, gradi) {
  const sw = sorgente.width, sh = sorgente.height
  const scala = Math.min(2.5, LATO / Math.max(sw, sh))
  const w = Math.round(sw * scala), h = Math.round(sh * scala)
  const c = gradi % 180 === 0 ? tela(w, h) : tela(h, w)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(gradi * Math.PI / 180)
  ctx.drawImage(sorgente, -w / 2, -h / 2, w, h)
  return c
}

function ripulita(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const px = img.data, n = c.width * c.height
  const grigi = new Uint8Array(n)
  for (let i = 0; i < n; i++) grigi[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) >> 8
  const bn = pulisciImmagine(grigi, c.width, c.height)
  for (let i = 0; i < n; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = bn[i]; px[i * 4 + 3] = 255 }
  ctx.putImageData(img, 0, 0)
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Immagine non convertibile')), 'image/png'))
}

async function leggiImmagine(worker, sorgente, onStato, provaRotazioni) {
  let migliore = []
  for (const gradi of (provaRotazioni ? [0, 270, 90, 180] : [0])) {
    onStato(gradi === 0 ? 'Leggo il foglio…' : 'Il foglio sembra girato: riprovo ruotandolo…')
    const { data } = await worker.recognize(await ripulita(ruotata(sorgente, gradi)))
    const righe = righeDaTesto(data.text)
    if (righe.length > migliore.length) migliore = righe
    if (righe.length >= 4) break   // orientamento giusto trovato
  }
  return migliore
}

let pdfPronto = null
function caricaPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  if (!pdfPronto) {
    pdfPronto = new Promise((ok, ko) => {
      const base = process.env.PUBLIC_URL || ''
      const s = document.createElement('script')
      s.src = `${base}/pdfjs-lib.js`
      s.onload = () => {
        if (!window.pdfjsLib) return ko(new Error('Lettore PDF non disponibile'))
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf-worker.min.js`
        ok(window.pdfjsLib)
      }
      s.onerror = () => ko(new Error('Lettore PDF non disponibile'))
      document.head.appendChild(s)
    })
  }
  return pdfPronto
}

// Testo di una pagina PDF "vera" (non scansionata), ricomposto riga per riga
async function testoPagina(pagina) {
  const { items } = await pagina.getTextContent()
  const righe = []
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue
    const x = it.transform[4], y = it.transform[5]
    const r = righe.find(g => Math.abs(g.y - y) <= 3)
    if (r) r.pezzi.push({ x, s: it.str }); else righe.push({ y, pezzi: [{ x, s: it.str }] })
  }
  return righe.sort((a, b) => b.y - a.y)
    .map(r => r.pezzi.sort((a, b) => a.x - b.x).map(p => p.s).join('  ')).join('\n')
}

export async function leggiConOcr(file, onStato = () => {}) {
  const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  let documento = null
  if (pdf) {
    onStato('Apro il PDF…')
    const pdfjs = await caricaPdfjs()
    documento = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    // se il PDF contiene gia' il testo non serve "leggerlo": e' anche piu' preciso
    let testo = ''
    for (let n = 1; n <= Math.min(documento.numPages, 10); n++) testo += await testoPagina(await documento.getPage(n)) + '\n'
    const righe = righeDaTesto(testo)
    if (righe.length >= 2) return righe
  }

  onStato('Avvio il lettore…')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ita', 1, {
    workerPath: `${process.env.PUBLIC_URL || ''}/tesseract-worker.min.js`,
    logger: m => { if (m.status === 'loading language traineddata') onStato('Scarico la lingua italiana (solo la prima volta)…') },
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    if (!documento) {
      const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
      return await leggiImmagine(worker, img, onStato, true)
    }
    const tutte = []
    for (let n = 1; n <= Math.min(documento.numPages, 5); n++) {
      const pagina = await documento.getPage(n)
      const vista = pagina.getViewport({ scale: 2.5 })
      const c = tela(Math.round(vista.width), Math.round(vista.height))
      await pagina.render({ canvasContext: c.getContext('2d'), viewport: vista }).promise
      tutte.push(...await leggiImmagine(worker, c, onStato, n === 1))
    }
    return tutte
  } finally {
    await worker.terminate()
  }
}
