import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ReportPresenze() {
  const { profilo } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [classi, setClassi] = useState([])
  const [classeId, setClasseId] = useState('')
  const [report, setReport] = useState([])
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { caricaClassi() }, [profilo])
  useEffect(() => { if (classeId) caricaReport() }, [classeId])

  const caricaClassi = async () => {
    let q = supabase.from('classi').select('id, nome').eq('attiva', true).order('nome')
    if (profilo?.ruolo === 'catechista') {
      const { data: cc } = await supabase.from('classi_catechisti').select('classe_id').eq('catechista_id', profilo.id)
      const ids = (cc || []).map(x => x.classe_id)
      if (ids.length > 0) q = q.in('id', ids)
    }
    const { data } = await q
    setClassi(data || [])
    if (data?.length === 1) setClasseId(data[0].id)
  }

  const caricaReport = async () => {
    setLoading(true)
    const { data: bambini } = await supabase.from('bambini')
      .select('id, nome, cognome').eq('classe_id', classeId).eq('attivo', true).order('cognome')
    const { data: dt } = await supabase.from('date_catechismo')
      .select('id, data, descrizione').order('data')
    const { data: pres } = await supabase.from('presenze')
      .select('bambino_id, data_id, stato, note_bambino')
      .in('bambino_id', (bambini || []).map(b => b.id))

    const presMap = {}
    pres?.forEach(p => {
      if (!presMap[p.bambino_id]) presMap[p.bambino_id] = {}
      presMap[p.bambino_id][p.data_id] = { stato: p.stato, nota: p.note_bambino }
    })

    const rows = (bambini || []).map(b => {
      const bp = presMap[b.id] || {}
      let totP = 0, totA = 0
      dt?.forEach(d => {
        if (bp[d.id]?.stato === 'P') totP++
        if (bp[d.id]?.stato === 'A') totA++
      })
      return { ...b, presenze: bp, totP, totA, totIncontri: totP + totA }
    })

    setReport(rows)
    setDate(dt || [])
    setLoading(false)
  }

  const exportCSV = () => {
    setExporting(true)
    let csv = 'Cognome,Nome'
    date.forEach(d => { csv += ',' + new Date(d.data).toLocaleDateString('it-IT') })
    csv += ',Presenze,Assenze,% Presenza\n'
    report.forEach(b => {
      let riga = `"${b.cognome}","${b.nome}"`
      date.forEach(d => { riga += ',' + (b.presenze[d.id]?.stato || '') })
      const perc = b.totIncontri > 0 ? Math.round((b.totP / b.totIncontri) * 100) : 0
      riga += `,${b.totP},${b.totA},${perc}%`
      csv += riga + '\n'
    })
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `registro_${classi.find(c=>c.id===classeId)?.nome || 'classe'}.csv`
    a.click(); URL.revokeObjectURL(url)
    setExporting(false)
    toast('Export CSV completato ✓', 'success')
  }

  const stampaPDF = () => {
    const win = window.open('', '_blank')
    const classe = classi.find(c => c.id === classeId)?.nome || ''
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 9px; margin: 10mm; }
      h2 { color: #1a6b3c; margin-bottom: 4px; }
      p.sub { color: #888; margin-bottom: 8px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1a6b3c; color:#fff; padding:4px 6px; font-size:8px; white-space:nowrap; }
      td { padding:3px 6px; border-bottom:1px solid #e5e7eb; }
      tr:nth-child(even) td { background:#f9fafb; }
      .P { color:#1a6b3c; font-weight:bold; }
      .A { color:#c62828; font-weight:bold; }
      .tot { font-weight:bold; background:#f0fdf4 !important; }
      @media print { @page { margin: 8mm; size: landscape; } }
    </style></head><body>
    <h2>Registro Presenze — ${classe}</h2>
    <p class="sub">Parrocchia San Metodio · Siracusa · Generato il ${new Date().toLocaleDateString('it-IT')}</p>
    <table><thead><tr><th>Cognome</th><th>Nome</th>`
    date.forEach(d => { html += `<th>${new Date(d.data).toLocaleDateString('it-IT', { day:'numeric', month:'short' })}</th>` })
    html += `<th>P</th><th>A</th><th>%</th></tr></thead><tbody>`
    report.forEach(b => {
      html += `<tr><td>${b.cognome}</td><td>${b.nome}</td>`
      date.forEach(d => {
        const s = b.presenze[d.id]?.stato || ''
        html += `<td class="${s}">${s}</td>`
      })
      const perc = b.totIncontri > 0 ? Math.round((b.totP / b.totIncontri) * 100) : 0
      html += `<td class="tot P">${b.totP}</td><td class="tot A">${b.totA}</td><td class="tot">${perc}%</td></tr>`
    })
    html += `</tbody></table></body></html>`
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => win.print(), 500)
  }

  const chartData = report.map(b => ({
    nome: b.cognome,
    presenze: b.totP,
    assenze: b.totA,
  })).slice(0, 20)

  return (
    <div style={{ padding:16 }}>
      <ToastContainer/>
      <h1 style={{ marginBottom:16 }}>📊 Report Presenze</h1>

      <div className="form-group" style={{ marginBottom:16 }}>
        <label className="form-label">Seleziona classe</label>
        <select className="form-control" value={classeId} onChange={e => setClasseId(e.target.value)}>
          <option value="">— seleziona classe —</option>
          {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {classeId && !loading && report.length > 0 && (
        <>
          {/* Azioni export */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={exportCSV} disabled={exporting}>
              {exporting ? '...' : '⬇ Esporta CSV'}
            </button>
            <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={stampaPDF}>
              🖨️ Stampa PDF
            </button>
          </div>

          {/* Riepilogo */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
            <div style={{ background:'var(--primary-bg)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:'1.3rem', color:'var(--primary)' }}>{report.length}</div>
              <div style={{ fontSize:'0.65rem', color:'var(--primary)', fontWeight:700 }}>BAMBINI</div>
            </div>
            <div style={{ background:'var(--blue-bg)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:'1.3rem', color:'var(--blue)' }}>{date.length}</div>
              <div style={{ fontSize:'0.65rem', color:'var(--blue)', fontWeight:700 }}>INCONTRI</div>
            </div>
            <div style={{ background:'var(--primary-bg)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:'1.3rem', color:'var(--primary)' }}>
                {report.length > 0 ? Math.round(report.reduce((s,b) => s + (b.totIncontri > 0 ? b.totP/b.totIncontri*100 : 0), 0) / report.length) : 0}%
              </div>
              <div style={{ fontSize:'0.65rem', color:'var(--primary)', fontWeight:700 }}>MEDIA %</div>
            </div>
          </div>

          {/* Grafico */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-body">
                <div className="text-xs text-muted" style={{ marginBottom:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Presenze per bambino</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top:5, right:5, bottom:20, left:-20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                    <XAxis dataKey="nome" tick={{ fontSize:9 }} angle={-45} textAnchor="end" />
                    <YAxis tick={{ fontSize:10 }} />
                    <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }} />
                    <Bar dataKey="presenze" fill="var(--primary)" radius={[3,3,0,0]} name="Presenti" />
                    <Bar dataKey="assenze" fill="var(--red)" radius={[3,3,0,0]} name="Assenti" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabella riassuntiva */}
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bambino</th>
                    <th style={{ textAlign:'center' }}>P</th>
                    <th style={{ textAlign:'center' }}>A</th>
                    <th style={{ textAlign:'center' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sort((a,b) => b.totP - a.totP).map(b => {
                    const perc = b.totIncontri > 0 ? Math.round((b.totP / b.totIncontri) * 100) : 0
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight:700 }}>{b.cognome} {b.nome}</td>
                        <td style={{ textAlign:'center' }}><span className="badge badge-green">{b.totP}</span></td>
                        <td style={{ textAlign:'center' }}><span className="badge badge-red">{b.totA}</span></td>
                        <td style={{ textAlign:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, height:6, background:'var(--gray-200)', borderRadius:3 }}>
                              <div style={{ width:`${perc}%`, height:'100%', background: perc>=80 ? 'var(--primary)' : perc>=60 ? 'var(--gold)' : 'var(--red)', borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:'0.75rem', fontWeight:700, minWidth:32 }}>{perc}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && <div className="loader"><div className="spinner"/>Caricamento report...</div>}
      {classeId && !loading && report.length === 0 && (
        <div className="empty-state"><div className="icon">📊</div><p>Nessun dato disponibile per questa classe</p></div>
      )}
    </div>
  )
}