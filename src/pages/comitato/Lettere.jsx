import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { inviaLettera } from '../../lib/emailService'
import { emailConfigured } from '../../lib/emailConfig'

// ── Costanti template ──────────────────────────────────────────
const TESTO_INTRO = 'Con la presente comunicazione, il Comitato Parrocchiale della Parrocchia San Metodio di Siracusa desidera portare alla Sua/Vostra cortese attenzione quanto segue:'
const TESTO_CHIUSURA = 'Certi della Sua/Vostra collaborazione, restiamo a disposizione per qualsiasi ulteriore chiarimento.'

const dataOggi = () =>
  new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

const TEMPLATE = {
  data: dataOggi(),
  alla_attenzione: '',
  saluto: 'Reverendo Parroco',
  oggetto: '',
  testo_corpo: '',
  tipo_firma: 'parroco', // 'parroco' | 'comitato'
}

// ── Migrazione contenuto vecchio formato → nuovo ───────────────
const migra = (c) => {
  if (!c) return { ...TEMPLATE }
  if ('alla_attenzione' in c) return c  // già nuovo formato
  return {
    data: c.data || dataOggi(),
    alla_attenzione: c.destinatario || '',
    saluto: c.destinatario || 'Reverendo Parroco',
    oggetto: c.oggetto || '',
    testo_corpo: [c.testo_intro, c.testo_corpo, c.testo_chiusura].filter(Boolean).join('\n\n'),
    tipo_firma: 'parroco',
  }
}

// ── HTML per stampa / anteprima ────────────────────────────────
const buildHtml = (c, titolo, forPrint = true, baseUrl = '') => `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>${titolo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Times New Roman',Georgia,serif;color:#1a1a1a;font-size:12pt;background:#fff;}
  .page{width:210mm;min-height:297mm;position:relative;margin:0 auto;}
  .header-bar{height:5px;background:#2b4fa8;}
  .header{padding:10px 28px 10px;border-bottom:2px solid #2b4fa8;display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .header-left{display:flex;align-items:center;gap:14px;}
  .logo-comitato{width:72px;height:72px;object-fit:contain;flex-shrink:0;}
  .logo-parrocchia{width:52px;height:52px;object-fit:contain;flex-shrink:0;}
  .logo-fallback{width:58px;height:58px;border:2px solid #8b6832;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:8pt;color:#8b6832;font-weight:bold;text-align:center;line-height:1.4;}
  .h-name{font-size:17pt;font-weight:bold;color:#1a1a1a;font-family:Arial,sans-serif;line-height:1.15;}
  .h-sub{font-size:7.5pt;color:#8b6832;text-transform:uppercase;letter-spacing:.18em;margin-top:3px;font-family:Arial,sans-serif;font-weight:bold;}
  .h-par{font-size:9.5pt;color:#5a4530;font-style:italic;margin-top:2px;font-family:Arial,sans-serif;}
  .header-right{text-align:right;font-size:9pt;color:#5a4530;line-height:1.7;font-family:Arial,sans-serif;display:flex;align-items:center;gap:10px;}
  .body{padding:22px 36px 80px;}
  .meta{text-align:right;margin-bottom:22px;font-size:11pt;}
  .alla{font-size:11pt;margin-bottom:5px;}
  .dest-line{display:inline-block;border-bottom:1px solid #1a1a1a;min-width:260px;padding-bottom:3px;font-size:11pt;margin-bottom:16px;}
  hr{border:none;border-top:1px solid #bbb;margin:14px 0 16px;}
  .ogg{font-size:11pt;margin-bottom:14px;}
  .saluto{font-size:11pt;margin-bottom:18px;}
  .par{text-align:justify;font-size:11pt;margin-bottom:14px;line-height:1.85;}
  .in-fede{font-size:11pt;margin-top:22px;margin-bottom:52px;}
  .firma-block{text-align:right;margin-top:8px;}
  .firma-titolo{font-size:10pt;color:#1a1a1a;}
  .firma-nome{font-style:italic;font-weight:bold;font-size:13pt;border-bottom:1.5px solid #1a1a1a;display:inline-block;padding-bottom:2px;margin-top:36px;}
  .footer{position:fixed;bottom:0;left:0;right:0;border-top:2px solid #2b4fa8;display:flex;align-items:center;justify-content:space-between;padding:5px 28px;font-size:7.5pt;color:#5a4530;font-family:Arial,sans-serif;background:#fff;}
  .pag{background:#2b4fa8;color:#fff;padding:2px 10px;font-weight:bold;font-size:7.5pt;}
  @media print{@page{size:A4;margin:0;}body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
</style></head><body>
<div class="page">
  <div class="header-bar"></div>
  <div class="header">
    <div class="header-left">
      <img src="${baseUrl}/logo-comitato.png" class="logo-comitato"
        onerror="this.outerHTML='<div class=\\'logo-fallback\\'>✝<br>SAN<br>MET.</div>'" />
      <div>
        <div class="h-name">Parrocchia San Metodio</div>
        <div class="h-sub">Comitato Parrocchiale</div>
        <div class="h-par">Padre Marco Tarascio, Parroco</div>
      </div>
    </div>
    <div class="header-right">
      <div style="line-height:1.6">Piazza San Metodio, 1 — Siracusa<br>Tel. 0931 705664<br>parrocchiasanmetodio@email.it</div>
      <img src="${baseUrl}/logo-parrocchia.png" class="logo-parrocchia"
        onerror="this.style.display='none'" />
    </div>
  </div>

  <div class="body">
    <div class="meta">Siracusa, ${c.data || dataOggi()}</div>
    <div class="alla">Alla cortese attenzione di</div>
    <div class="dest-line">${c.alla_attenzione || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</div>
    <hr>
    <div class="ogg"><strong>Oggetto:</strong>&nbsp; ${c.oggetto || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</div>
    <div class="saluto">Gentile/i ${c.saluto || ''},</div>
    <div class="par">${TESTO_INTRO}</div>
    <div class="par">${(c.testo_corpo || '').replace(/\n/g, '<br>')}</div>
    <div class="par">${TESTO_CHIUSURA}</div>
    <div class="in-fede">In fede,</div>
    <div class="firma-block">
      ${c.tipo_firma === 'comitato'
        ? '<div class="firma-titolo">Per il Comitato Parrocchiale</div>'
        : '<div class="firma-titolo">Il Parroco</div><div class="firma-nome">Padre Marco Tarascio</div>'
      }
    </div>
  </div>

  <div class="footer">
    <span>Parrocchia San Metodio — Piazza San Metodio, 1 — 96100 Siracusa — Tel. 0931 705664</span>
    <span class="pag">Pag. 1</span>
  </div>
</div>
${forPrint ? '<script>window.onload=()=>{window.print()}<\/script>' : ''}
</body></html>`

// ══════════════════════════════════════════════════════════════
export default function Lettere() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()

  const [lettere, setLettere] = useState([])
  const [rubrica, setRubrica] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'editor'
  const [letteraCorrente, setLetteraCorrente] = useState(null)
  const [contenuto, setContenuto] = useState({ ...TEMPLATE })
  const [titolo, setTitolo] = useState('')
  const [stato, setStato] = useState('bozza')
  const [saving, setSaving] = useState(false)
  const [mostraRubricaDropdown, setMostraRubricaDropdown] = useState(false)
  const [filtroRubrica, setFiltroRubrica] = useState('')
  const [modalEmail, setModalEmail] = useState(false)
  const [emailDest, setEmailDest] = useState('')
  const [inviando, setInviando] = useState(false)

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('lettere').select('*, profili(nome,cognome)').order('created_at', { ascending: false }),
      supabase.from('rubrica').select('id, nome_ente, referente, email, telefono').order('nome_ente'),
    ])
    setLettere(l || [])
    setRubrica(r || [])
    setLoading(false)
  }

  const nuovaLettera = () => {
    setLetteraCorrente(null)
    setContenuto({ ...TEMPLATE, data: dataOggi() })
    setTitolo('')
    setStato('bozza')
    setVista('editor')
  }

  const apriLettera = (l) => {
    setLetteraCorrente(l)
    setContenuto(migra(l.contenuto))
    setTitolo(l.titolo || '')
    setStato(l.stato || 'bozza')
    setVista('editor')
  }

  const salva = async (nuovoStato) => {
    if (!titolo.trim()) return toast('Inserisci un titolo per la lettera', 'error')
    setSaving(true)
    const s = nuovoStato || stato
    const dati = {
      titolo: titolo.trim(),
      destinatario_libero: contenuto.alla_attenzione || '',
      contenuto,
      stato: s,
      autore_id: profilo?.id,
    }
    const { error } = letteraCorrente
      ? await supabase.from('lettere').update(dati).eq('id', letteraCorrente.id)
      : await supabase.from('lettere').insert(dati).select().single().then(({ data, error }) => {
          if (data) setLetteraCorrente(data)
          return { error }
        })
    if (error) toast('Errore nel salvataggio', 'error')
    else { toast('Lettera salvata ✓', 'success'); setStato(s); carica() }
    setSaving(false)
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa lettera?')) return
    await supabase.from('lettere').delete().eq('id', id)
    toast('Lettera eliminata', 'success')
    carica()
  }

  const stampa = () => {
    const win = window.open('', '_blank')
    win.document.write(buildHtml(contenuto, titolo, true, window.location.origin))
    win.document.close()
  }

  const set = (key) => (e) =>
    setContenuto(c => ({ ...c, [key]: typeof e === 'string' ? e : e.target.value }))

  const apriModalEmail = () => {
    // Pre-compila con email rubrica se disponibile
    const contatto = rubrica.find(r =>
      contenuto.alla_attenzione && r.nome_ente && contenuto.alla_attenzione.includes(r.nome_ente)
    )
    setEmailDest(contatto?.email || '')
    setModalEmail(true)
  }

  const inviaEmailLettera = async () => {
    if (!emailDest.trim() || !emailDest.includes('@')) return toast('Inserisci un indirizzo email valido', 'error')
    setInviando(true)
    try {
      const testoPlain = [
        `${titolo}`,
        `Siracusa, ${contenuto.data}`,
        `Alla cortese attenzione di ${contenuto.alla_attenzione}`,
        `Oggetto: ${contenuto.oggetto}`,
        '',
        'Gentile/i ' + contenuto.saluto + ',',
        '',
        'Con la presente comunicazione, il Comitato Parrocchiale della Parrocchia San Metodio di Siracusa desidera portare alla Sua/Vostra cortese attenzione quanto segue:',
        '',
        contenuto.testo_corpo,
        '',
        'Certi della Sua/Vostra collaborazione, restiamo a disposizione per qualsiasi ulteriore chiarimento.',
        '',
        'In fede,',
        contenuto.tipo_firma === 'comitato' ? 'Per il Comitato Parrocchiale' : 'Il Parroco\nPadre Marco Tarascio',
        '',
        '— Parrocchia San Metodio, Piazza San Metodio 1, Siracusa',
      ].join('\n')

      if (emailConfigured()) {
        await inviaLettera({ emailDest: emailDest.trim(), oggetto: contenuto.oggetto || titolo, testo: testoPlain })
        toast('Email inviata a ' + emailDest.trim() + ' ✓', 'success')
        await salva('inviata')
        setModalEmail(false)
      } else {
        // Fallback: apri client email con mailto
        const body = encodeURIComponent(testoPlain)
        const subj = encodeURIComponent((contenuto.oggetto || titolo) + ' — Parrocchia San Metodio')
        window.open(`mailto:${emailDest.trim()}?subject=${subj}&body=${body}`)
        setModalEmail(false)
      }
    } catch {
      toast('Errore nell\'invio — riprova', 'error')
    }
    setInviando(false)
  }

  const selezionaRubrica = (contatto) => {
    const destinatario = contatto.referente
      ? `${contatto.referente}, ${contatto.nome_ente}`
      : contatto.nome_ente
    setContenuto(c => ({ ...c, alla_attenzione: destinatario }))
    setMostraRubricaDropdown(false)
    setFiltroRubrica('')
  }

  const rubricaFiltrata = rubrica.filter(r =>
    !filtroRubrica || r.nome_ente.toLowerCase().includes(filtroRubrica.toLowerCase())
  )

  // ─────────────────────────────────────────────────────────────
  if (vista === 'editor') {
    const htmlAnteprima = buildHtml(contenuto, titolo, false, window.location.origin)

    return (
      <div style={{ padding: 16 }}>
        <ToastContainer />

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setVista('lista'); carica() }}>‹ Lista</button>
          <input
            className="form-control"
            placeholder="Titolo lettera (uso interno) *"
            value={titolo}
            onChange={e => setTitolo(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-outline btn-sm" onClick={stampa}>🖨️ Stampa / PDF</button>
          <button className="btn btn-outline btn-sm" onClick={apriModalEmail}>✉️ Invia email</button>
          <button className="btn btn-primary btn-sm" onClick={() => salva()} disabled={saving}>
            {saving ? 'Salvataggio...' : '💾 Salva'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Intestazione ────────────────────────── */}
          <div className="card">
            <div className="card-header"><h3>📋 Intestazione</h3></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Data</label>
                  <input className="form-control" value={contenuto.data} onChange={set('data')}
                    placeholder="Es: 4 giugno 2026" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Destinatario ─────────────────────────── */}
          <div className="card">
            <div className="card-header"><h3>👤 Destinatario</h3></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Alla cortese attenzione di</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-control"
                      value={contenuto.alla_attenzione}
                      onChange={set('alla_attenzione')}
                      placeholder="Es: Rev. Parroco della Cattedrale di Siracusa"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      onClick={() => setMostraRubricaDropdown(v => !v)}
                    >📇 Rubrica</button>
                  </div>
                  {/* Dropdown rubrica */}
                  {mostraRubricaDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                      background: '#fff', border: '1.5px solid var(--gray-200)',
                      borderRadius: 10, boxShadow: 'var(--shadow-lg)', marginTop: 4,
                    }}>
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gray-100)' }}>
                        <input
                          className="form-control"
                          placeholder="Cerca nella rubrica..."
                          value={filtroRubrica}
                          onChange={e => setFiltroRubrica(e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                          autoFocus
                        />
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {rubricaFiltrata.slice(0, 30).map(r => (
                          <div
                            key={r.id}
                            onClick={() => selezionaRubrica(r)}
                            style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--gray-50)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 700 }}>{r.nome_ente}</div>
                            {r.referente && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{r.referente}</div>}
                          </div>
                        ))}
                        {rubricaFiltrata.length === 0 && (
                          <div style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--gray-500)' }}>Nessun contatto trovato</div>
                        )}
                      </div>
                      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--gray-100)' }}>
                        <button className="btn btn-ghost btn-sm btn-block" onClick={() => setMostraRubricaDropdown(false)}>Chiudi</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Saluto — Gentile/i&nbsp;<em style={{ fontWeight: 400 }}>(cosa segue "Gentile/i")</em></label>
                <input
                  className="form-control"
                  value={contenuto.saluto}
                  onChange={set('saluto')}
                  placeholder="Es: Reverendo Parroco  |  Direttore  |  Signora"
                />
              </div>
            </div>
          </div>

          {/* ── Contenuto ───────────────────────────── */}
          <div className="card">
            <div className="card-header"><h3>✍️ Contenuto</h3></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Oggetto</label>
                <input
                  className="form-control"
                  value={contenuto.oggetto}
                  onChange={set('oggetto')}
                  placeholder="Es: Invito alla Processione del 7 luglio"
                />
              </div>
              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.8rem', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                <strong style={{ color: 'var(--gray-700)' }}>Testo fisso:</strong> «Con la presente comunicazione, il Comitato Parrocchiale… quanto segue:»
              </div>
              <div className="form-group">
                <label className="form-label">Corpo della lettera</label>
                <textarea
                  className="form-control"
                  rows={8}
                  value={contenuto.testo_corpo}
                  onChange={set('testo_corpo')}
                  placeholder="Scrivi qui il contenuto principale della lettera..."
                />
              </div>
              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                <strong style={{ color: 'var(--gray-700)' }}>Testo fisso:</strong> «Certi della Sua/Vostra collaborazione, restiamo a disposizione…»
              </div>
            </div>
          </div>

          {/* ── Firma ───────────────────────────────── */}
          <div className="card">
            <div className="card-header"><h3>✍️ Firma</h3></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { val: 'parroco',  label: 'Il Parroco',  sub: 'Padre Marco Tarascio' },
                  { val: 'comitato', label: 'Per il Comitato', sub: 'Parrocchiale' },
                ].map(opt => (
                  <div
                    key={opt.val}
                    onClick={() => setContenuto(c => ({ ...c, tipo_firma: opt.val }))}
                    style={{
                      flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${contenuto.tipo_firma === opt.val ? 'var(--primary)' : 'var(--gray-200)'}`,
                      background: contenuto.tipo_firma === opt.val ? 'var(--primary-bg)' : '#fff',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: contenuto.tipo_firma === opt.val ? 'var(--primary)' : 'var(--gray-700)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--gray-500)', marginTop: 2 }}>{opt.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Anteprima ────────────────────────────── */}
          <div className="card" style={{ marginBottom: 8 }}>
            <div className="card-header"><h3>👁 Anteprima</h3></div>
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
              <iframe
                srcDoc={htmlAnteprima}
                style={{ width: '100%', minHeight: 520, border: 'none' }}
                title="Anteprima lettera"
              />
            </div>
          </div>

          {/* ── Azioni ──────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <button className="btn btn-outline btn-block" onClick={() => salva('bozza')} disabled={saving}>Salva bozza</button>
            <button className="btn btn-primary btn-block" onClick={() => salva('inviata')} disabled={saving}>Segna inviata</button>
          </div>
        </div>

        {/* ── Modal: INVIA PER EMAIL ──────────────── */}
        {modalEmail && (
          <div className="modal-overlay" onClick={() => setModalEmail(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">✉️ Invia lettera per email</div>

              {!emailConfigured() && (
                <div style={{ background: '#fff8e1', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.78rem', color: '#8a6900' }}>
                  EmailJS non configurato — verrà aperto il tuo client email (Outlook, Gmail...) con il testo pre-compilato.
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email destinatario</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="es. destinatario@email.it"
                  value={emailDest}
                  onChange={e => setEmailDest(e.target.value)}
                  autoFocus
                />
                {rubrica.filter(r => r.email).length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rubrica.filter(r => r.email).slice(0, 8).map(r => (
                      <div
                        key={r.id}
                        onClick={() => setEmailDest(r.email)}
                        style={{
                          fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20,
                          background: emailDest === r.email ? 'var(--primary)' : 'var(--gray-100)',
                          color: emailDest === r.email ? '#fff' : 'var(--gray-700)',
                          cursor: 'pointer', fontWeight: 600
                        }}
                      >{r.nome_ente}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                <strong>Oggetto:</strong> {contenuto.oggetto || titolo || '(nessun oggetto)'}<br />
                <strong>A:</strong> {contenuto.alla_attenzione || '—'}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline btn-block" onClick={() => setModalEmail(false)}>Annulla</button>
                <button className="btn btn-primary btn-block" onClick={inviaEmailLettera} disabled={inviando}>
                  {inviando ? 'Invio...' : emailConfigured() ? '✉️ Invia' : '✉️ Apri email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 16 }}>
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <h1>📄 Lettere</h1>
        <button className="btn btn-primary btn-sm" onClick={nuovaLettera}>＋ Nuova</button>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div>
        : lettere.length === 0 ? (
          <div className="empty-state"><div className="icon">📄</div><p>Nessuna lettera ancora.<br />Creane una!</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lettere.map(l => (
              <div key={l.id} className="card">
                <div className="card-body" style={{ padding: '13px 14px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, flex: 1, marginRight: 8 }}>{l.titolo}</div>
                    <span className={`badge ${l.stato === 'inviata' ? 'badge-green' : 'badge-gray'}`}>{l.stato}</span>
                  </div>
                  {l.destinatario_libero && <div className="text-sm text-muted">A: {l.destinatario_libero}</div>}
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    {new Date(l.created_at).toLocaleDateString('it-IT')}
                    {l.profili ? ` · ${l.profili.nome} ${l.profili.cognome}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => apriLettera(l)}>✏️ Modifica</button>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => {
                      const c = migra(l.contenuto)
                      const win = window.open('', '_blank')
                      win.document.write(buildHtml(c, l.titolo, true, window.location.origin))
                      win.document.close()
                    }}>🖨️ Stampa</button>
                    <button className="btn btn-outline btn-sm btn-icon" title="Invia per email" onClick={() => {
                      const c = migra(l.contenuto)
                      const testo = [`Siracusa, ${c.data}`, `Alla cortese attenzione di ${c.alla_attenzione}`, `Oggetto: ${c.oggetto}`, '', `Gentile/i ${c.saluto},`, '', 'Con la presente comunicazione, il Comitato Parrocchiale della Parrocchia San Metodio di Siracusa desidera portare alla Sua/Vostra cortese attenzione quanto segue:', '', c.testo_corpo, '', 'Certi della Sua/Vostra collaborazione, restiamo a disposizione per qualsiasi ulteriore chiarimento.', '', 'In fede,', c.tipo_firma === 'comitato' ? 'Per il Comitato Parrocchiale' : 'Il Parroco — Padre Marco Tarascio'].join('\n')
                      window.open(`mailto:?subject=${encodeURIComponent((c.oggetto || l.titolo) + ' — Parrocchia San Metodio')}&body=${encodeURIComponent(testo)}`)
                    }}>✉️</button>
                    <button className="btn btn-red btn-sm btn-icon" onClick={() => elimina(l.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
