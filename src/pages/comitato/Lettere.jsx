import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'

const TEMPLATE_DEFAULT = {
  luogo: 'Siracusa',
  data: new Date().toLocaleDateString('it-IT'),
  destinatario: 'Reverendo Parroco,',
  oggetto: '',
  testo_intro: 'Con la presente comunicazione, il Comitato Parrocchiale della Parrocchia San Metodio di Siracusa desidera portare alla Sua/Vostra cortese attenzione quanto segue:',
  testo_corpo: '',
  testo_chiusura: 'Certi della Vostra gradita partecipazione, porgiamo cordiali saluti nel Signore.',
  parroco: 'Padre Marco Tarascio',
}

export default function Lettere() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [lettere, setLettere] = useState([])
  const [rubrica, setRubrica] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // lista | editor | anteprima
  const [letteraCorrente, setLetteraCorrente] = useState(null)
  const [contenuto, setContenuto] = useState(TEMPLATE_DEFAULT)
  const [titolo, setTitolo] = useState('')
  const [destinatarioLibero, setDestinatarioLibero] = useState('')
  const [stato, setStato] = useState('bozza')
  const [saving, setSaving] = useState(false)
  const printRef = useRef()

  useEffect(() => { carica() }, [])

  const carica = async () => {
    setLoading(true)
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('lettere').select('*, profili(nome,cognome), rubrica(nome_ente,referente)').order('created_at', { ascending:false }),
      supabase.from('rubrica').select('id, nome_ente, referente').order('nome_ente')
    ])
    setLettere(l || [])
    setRubrica(r || [])
    setLoading(false)
  }

  const nuovaLettera = () => {
    setLetteraCorrente(null)
    setContenuto({ ...TEMPLATE_DEFAULT, data: new Date().toLocaleDateString('it-IT') })
    setTitolo('')
    setDestinatarioLibero('')
    setStato('bozza')
    setVista('editor')
  }

  const apriLettera = (l) => {
    setLetteraCorrente(l)
    setContenuto(l.contenuto || TEMPLATE_DEFAULT)
    setTitolo(l.titolo || '')
    setDestinatarioLibero(l.destinatario_libero || '')
    setStato(l.stato || 'bozza')
    setVista('editor')
  }

  const salva = async (nuovoStato) => {
    if (!titolo) return toast('Inserisci un titolo per la lettera', 'error')
    setSaving(true)
    const dati = { titolo, destinatario_libero: destinatarioLibero, contenuto, stato: nuovoStato || stato, autore_id: profilo?.id }
    if (letteraCorrente) {
      await supabase.from('lettere').update(dati).eq('id', letteraCorrente.id)
    } else {
      const { data } = await supabase.from('lettere').insert(dati).select().single()
      setLetteraCorrente(data)
    }
    setStato(nuovoStato || stato)
    toast('Lettera salvata', 'success')
    setSaving(false); carica()
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa lettera?')) return
    await supabase.from('lettere').delete().eq('id', id)
    toast('Lettera eliminata', 'success'); carica()
  }

  const stampa = () => {
    const win = window.open('', '_blank')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: Georgia, serif; margin: 0; padding: 0; color: #1a1a1a; font-size: 13px; }
      .header { padding: 20px 32px 16px; border-bottom: 2px solid #1a6b3c; display:flex; align-items:center; gap:16px; }
      .logo { width:60px; height:60px; border:2px solid #1a6b3c; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; color:#1a6b3c; font-weight:bold; text-align:center; line-height:1.3; }
      .header-text h1 { margin:0; font-size:18px; color:#1a6b3c; }
      .header-text p { margin:2px 0; font-size:10px; color:#5a5a5a; }
      .body { padding: 24px 32px; line-height:1.8; }
      .meta { text-align:right; margin-bottom:20px; }
      .oggetto { margin-bottom:18px; } .oggetto span { font-style:italic; text-decoration:underline; }
      .paragraph { margin-bottom:16px; text-align:justify; }
      .footer { border-top:2px solid #1a6b3c; padding:12px 32px; display:flex; justify-content:flex-end; }
      .firma { text-align:right; } .firma-name { font-style:italic; font-weight:bold; font-size:15px; }
      .colophon { background:#f5f0e8; padding:8px 32px; font-size:10px; color:#8b6e3c; display:flex; justify-content:space-between; }
      @media print { @page { margin:10mm; } }
    </style></head><body>
    <div class="header">
      <div class="logo">✝<br>SAN<br>METODIO</div>
      <div class="header-text">
        <h1>Parrocchia San Metodio</h1>
        <p>COMITATO PARROCCHIALE &nbsp;·&nbsp; <em>${contenuto.parroco}, Parroco</em></p>
        <p>Piazza San Metodio, 1 — 96100 Siracusa | Tel. 0931 705664</p>
      </div>
    </div>
    <div class="body">
      <div class="meta">${contenuto.luogo}, ${contenuto.data}</div>
      <div class="oggetto"><strong>Oggetto:</strong> <span>${contenuto.oggetto || titolo}</span></div>
      <div class="paragraph">${contenuto.destinatario}</div>
      <div class="paragraph">${contenuto.testo_intro}</div>
      <div class="paragraph">${contenuto.testo_corpo.replace(/\n/g,'<br>')}</div>
      <div class="paragraph">${contenuto.testo_chiusura}</div>
    </div>
    <div class="footer">
      <div class="firma">
        <div style="font-size:11px">Il Parroco</div>
        <div class="firma-name">${contenuto.parroco}</div>
        <div style="font-size:10px;color:#8b6e3c">Per il Comitato Parrocchiale</div>
      </div>
    </div>
    <div class="colophon">
      <span>Parrocchia San Metodio — Piazza San Metodio, 1 — 96100 Siracusa — Tel. 0931 705664</span>
      <span>Pag. 1</span>
    </div>
    </body></html>`
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  const set = (key) => (val) => setContenuto(c => ({ ...c, [key]: val }))
  const setE = (key) => (e) => set(key)(e.target.value)

  if (vista === 'editor' || vista === 'anteprima') {
    return (
      <div style={{ padding:16 }}>
        <ToastContainer/>
        {/* Topbar editor */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setVista('lista'); carica() }}>‹ Lista</button>
          <input className="form-control" placeholder="Titolo lettera *" value={titolo} onChange={e => setTitolo(e.target.value)} style={{ flex:1, minWidth:160 }} />
          <button className="btn btn-outline btn-sm" onClick={() => setVista(v => v==='anteprima' ? 'editor' : 'anteprima')}>
            {vista === 'anteprima' ? '✏️ Modifica' : '👁 Anteprima'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={stampa}>🖨️ Stampa/PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => salva()} disabled={saving}>
            {saving ? 'Salvataggio...' : '💾 Salva'}
          </button>
        </div>

        {vista === 'anteprima' ? (
          /* ANTEPRIMA LETTERA */
          <div ref={printRef} style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', fontFamily:'Georgia, serif', fontSize:'13px', lineHeight:1.8 }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'2px solid #1a6b3c', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, border:'2px solid #1a6b3c', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#1a6b3c', fontWeight:'bold', textAlign:'center', lineHeight:1.3, flexShrink:0 }}>✝<br/>SAN<br/>MET.</div>
              <div>
                <div style={{ fontWeight:'bold', fontSize:'15px', color:'#1a6b3c' }}>Parrocchia San Metodio</div>
                <div style={{ fontSize:'9px', color:'#8b6e3c', letterSpacing:'0.1em' }}>COMITATO PARROCCHIALE</div>
                <div style={{ fontSize:'11px', color:'#5a4530', fontStyle:'italic' }}>{contenuto.parroco}, Parroco</div>
                <div style={{ fontSize:'10px', color:'#5a4530' }}>Piazza San Metodio, 1 — 96100 Siracusa</div>
              </div>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ textAlign:'right', marginBottom:16 }}>{contenuto.luogo}, {contenuto.data}</div>
              <div style={{ marginBottom:14 }}><strong>Oggetto:</strong> <em style={{ textDecoration:'underline' }}>{contenuto.oggetto || titolo}</em></div>
              <div style={{ marginBottom:12 }}>{contenuto.destinatario}</div>
              <div style={{ marginBottom:12, textAlign:'justify' }}>{contenuto.testo_intro}</div>
              <div style={{ marginBottom:12, textAlign:'justify', whiteSpace:'pre-wrap' }}>{contenuto.testo_corpo}</div>
              <div style={{ marginBottom:12, textAlign:'justify' }}>{contenuto.testo_chiusura}</div>
            </div>
            <div style={{ borderTop:'2px solid #1a6b3c', padding:'12px 24px', display:'flex', justifyContent:'flex-end' }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'11px', color:'#5a4530' }}>Il Parroco</div>
                <div style={{ fontStyle:'italic', fontWeight:'bold', fontSize:'14px' }}>{contenuto.parroco}</div>
                <div style={{ fontSize:'10px', color:'#8b6e3c' }}>Per il Comitato Parrocchiale</div>
              </div>
            </div>
            <div style={{ background:'#f5f0e8', padding:'6px 24px', display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#8b6e3c' }}>
              <span>Parrocchia San Metodio — Piazza San Metodio, 1 — 96100 Siracusa — Tel. 0931 705664</span>
              <span>Pag. 1</span>
            </div>
          </div>
        ) : (
          /* EDITOR */
          <div>
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Luogo</label><input className="form-control" value={contenuto.luogo} onChange={setE('luogo')} /></div>
                  <div className="form-group"><label className="form-label">Data</label><input className="form-control" value={contenuto.data} onChange={setE('data')} /></div>
                </div>
                <div className="form-group"><label className="form-label">Oggetto</label><input className="form-control" value={contenuto.oggetto} onChange={setE('oggetto')} placeholder="Es: Invito alla Processione di San Metodio" /></div>
                <div className="form-group"><label className="form-label">Destinatario</label><input className="form-control" value={contenuto.destinatario} onChange={setE('destinatario')} /></div>
              </div>
            </div>
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-header"><h3>Corpo della lettera</h3></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Paragrafo introduttivo</label><textarea className="form-control" rows={3} value={contenuto.testo_intro} onChange={setE('testo_intro')} /></div>
                <div className="form-group"><label className="form-label">Testo principale</label><textarea className="form-control" rows={6} value={contenuto.testo_corpo} onChange={setE('testo_corpo')} placeholder="Scrivi il contenuto principale della lettera..." /></div>
                <div className="form-group"><label className="form-label">Chiusura</label><textarea className="form-control" rows={2} value={contenuto.testo_chiusura} onChange={setE('testo_chiusura')} /></div>
              </div>
            </div>
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom:0 }}><label className="form-label">Nome firma</label><input className="form-control" value={contenuto.parroco} onChange={setE('parroco')} /></div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-outline btn-block" onClick={() => salva('bozza')} disabled={saving}>Salva bozza</button>
              <button className="btn btn-primary btn-block" onClick={() => salva('inviata')} disabled={saving}>Segna come inviata</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <div className="flex items-center justify-between mb-4">
        <h1>📄 Lettere</h1>
        <button className="btn btn-primary btn-sm" onClick={nuovaLettera}>＋ Nuova</button>
      </div>
      {loading ? <div className="loader"><div className="spinner"/></div> : lettere.length === 0 ? (
        <div className="empty-state"><div className="icon">📄</div><p>Nessuna lettera.<br/>Creane una!</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {lettere.map(l => (
            <div key={l.id} className="card">
              <div className="card-body" style={{ padding:'13px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom:6 }}>
                  <div style={{ fontWeight:800, flex:1, marginRight:8 }}>{l.titolo}</div>
                  <span className={`badge ${l.stato==='inviata' ? 'badge-green' : 'badge-gray'}`}>{l.stato}</span>
                </div>
                {l.destinatario_libero && <div className="text-sm text-muted">A: {l.destinatario_libero}</div>}
                <div className="text-xs text-muted" style={{ marginTop:4 }}>
                  {new Date(l.created_at).toLocaleDateString('it-IT')}
                  {l.profili ? ` · ${l.profili.nome} ${l.profili.cognome}` : ''}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={() => apriLettera(l)}>✏️ Modifica</button>
                  <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => { apriLettera(l); setTimeout(() => setVista('anteprima'), 100) }}>👁 Apri</button>
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