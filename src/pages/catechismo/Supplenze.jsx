import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../hooks/useToast'
import Icon from '../../components/Icon'

const fmtData = (d) => new Date(d + 'T00:00:00')
  .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

export default function Supplenze() {
  const { profilo, tuttiRuoli } = useAuth()
  const { toast, ToastContainer } = useToast()
  const isAdmin = ['admin', 'parroco', 'segreteria'].some(r => tuttiRuoli.includes(r))

  const [supplenze, setSupplenze] = useState([])
  const [classi, setClassi] = useState([])
  const [catechisti, setCatechisti] = useState([])
  const [date, setDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ classe_id: '', catechista_supplente_id: '', data_id: '', messaggio: '' })
  const [saving, setSaving] = useState(false)
  const [vista, setVista] = useState('ricevute')

  useEffect(() => { if (profilo) carica() }, [profilo])

  const carica = async () => {
    setLoading(true)
    const oggi = new Date().toISOString().split('T')[0]
    const [{ data: sup }, { data: cl }, { data: cat }, { data: dt }] = await Promise.all([
      supabase.from('supplenze').select(`
        id, created_at, stato, messaggio, risposto_at, classe_id, data_id,
        catechista_supplente_id, richiesto_da,
        classi(nome),
        supplente:profili!catechista_supplente_id(nome, cognome),
        richiedente:profili!richiesto_da(nome, cognome),
        date_catechismo(data)
      `).order('created_at', { ascending: false }),
      supabase.from('classi').select('id, nome').eq('attiva', true).order('nome'),
      supabase.from('profili').select('id, nome, cognome, ruolo, ruoli_extra')
        .eq('attivo', true).order('cognome'),
      supabase.from('date_catechismo').select('id, data')
        .gte('data', oggi).order('data').limit(20),
    ])

    setSupplenze(sup || [])
    setClassi(cl || [])
    setCatechisti((cat || []).filter(p =>
      p.id !== profilo.id && (
        ['catechista', 'responsabile', 'segreteria'].includes(p.ruolo) ||
        (p.ruoli_extra || []).includes('catechista')
      )
    ))
    setDate(dt || [])
    setLoading(false)
  }

  const chiedi = async () => {
    if (!form.classe_id || !form.catechista_supplente_id || !form.data_id) {
      return toast('Classe, data e collega sono obbligatori', 'error')
    }
    setSaving(true)
    const { error } = await supabase.from('supplenze').insert({
      classe_id: form.classe_id,
      catechista_supplente_id: form.catechista_supplente_id,
      data_id: form.data_id,
      messaggio: form.messaggio || null,
      richiesto_da: profilo.id,
      stato: isAdmin && form.diretta ? 'attiva' : 'in_attesa',
    })
    setSaving(false)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast('Richiesta inviata', 'success')
    setModal(false)
    setForm({ classe_id: '', catechista_supplente_id: '', data_id: '', messaggio: '' })
    carica()
  }

  const rispondi = async (s, accetta) => {
    const { error } = await supabase.from('supplenze')
      .update({ stato: accetta ? 'accettata' : 'rifiutata', risposto_at: new Date().toISOString() })
      .eq('id', s.id)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast(accetta ? 'Supplenza accettata' : 'Richiesta rifiutata', accetta ? 'success' : 'error')
    carica()
  }

  const annulla = async (id) => {
    if (!window.confirm('Annullare questa richiesta?')) return
    const { error } = await supabase.from('supplenze').delete().eq('id', id)
    if (error) return toast('Errore: ' + error.message, 'error')
    toast('Richiesta annullata', 'success'); carica()
  }

  const ricevute = supplenze.filter(s => s.catechista_supplente_id === profilo?.id && s.stato === 'in_attesa')
  const inviate = supplenze.filter(s => s.richiesto_da === profilo?.id)
  const tutte = supplenze

  const badgeStato = (stato) => {
    const m = {
      in_attesa: ['badge-gold', 'In attesa'],
      accettata: ['badge-green', 'Accettata'],
      attiva: ['badge-green', 'Attiva'],
      rifiutata: ['badge-red', 'Rifiutata'],
    }[stato] || ['badge-gray', stato]
    return <span className={'badge ' + m[0]}>{m[1]}</span>
  }

  const Scheda = ({ s, azioni }) => (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="card-body">
        <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{s.classi?.nome || 'Classe'}</div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              {s.date_catechismo?.data ? fmtData(s.date_catechismo.data) : 'data non trovata'}
            </div>
          </div>
          {badgeStato(s.stato)}
        </div>

        <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <Icon name="coristi" size={15} style={{ color: 'var(--gray-500)' }} />
          {s.richiedente
            ? <span><strong>{s.richiedente.nome} {s.richiedente.cognome}</strong> chiede a </span>
            : <span>Assegnata a </span>}
          <strong>{s.supplente?.nome} {s.supplente?.cognome}</strong>
        </div>

        {s.messaggio && (
          <div style={{ marginTop: 9, padding: '9px 11px', background: 'var(--gray-50)', borderRadius: 9 }}>
            <div className="text-sm" style={{ color: 'var(--gray-700)' }}>{s.messaggio}</div>
          </div>
        )}

        {azioni}
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <h1>Supplenze</h1>
        <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => setModal(true)}>
          <Icon name="supplenze" size={16} /> Chiedi supplenza
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        <button type="button" className={'chip' + (vista === 'ricevute' ? ' on' : '')} onClick={() => setVista('ricevute')}>
          Da rispondere {ricevute.length > 0 && <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: '0.7rem' }}>{ricevute.length}</span>}
        </button>
        <button type="button" className={'chip' + (vista === 'inviate' ? ' on' : '')} onClick={() => setVista('inviate')}>
          Le mie richieste <span style={{ opacity: .7 }}>{inviate.length}</span>
        </button>
        {isAdmin && (
          <button type="button" className={'chip' + (vista === 'tutte' ? ' on' : '')} onClick={() => setVista('tutte')}>
            Tutte <span style={{ opacity: .7 }}>{tutte.length}</span>
          </button>
        )}
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <>
          {vista === 'ricevute' && (
            ricevute.length === 0 ? (
              <div className="empty-state">
                <Icon name="supplenze" size={44} style={{ color: 'var(--gray-300)' }} />
                <p style={{ marginTop: 12 }}>Nessuna richiesta in attesa di risposta.</p>
              </div>
            ) : ricevute.map(s => (
              <Scheda key={s.id} s={s} azioni={
                <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
                  <button className="btn btn-outline btn-block" onClick={() => rispondi(s, false)}>Non posso</button>
                  <button className="btn btn-primary btn-block" onClick={() => rispondi(s, true)}>Accetto</button>
                </div>
              } />
            ))
          )}

          {vista === 'inviate' && (
            inviate.length === 0 ? (
              <div className="empty-state"><p>Non hai ancora chiesto nessuna supplenza.</p></div>
            ) : inviate.map(s => (
              <Scheda key={s.id} s={s} azioni={
                s.stato === 'in_attesa' ? (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => annulla(s.id)}>Annulla richiesta</button>
                  </div>
                ) : null
              } />
            ))
          )}

          {vista === 'tutte' && isAdmin && (
            tutte.length === 0 ? (
              <div className="empty-state"><p>Nessuna supplenza registrata.</p></div>
            ) : tutte.map(s => (
              <Scheda key={s.id} s={s} azioni={
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-red btn-sm" onClick={() => annulla(s.id)}>Elimina</button>
                </div>
              } />
            ))
          )}
        </>
      )}

      {/* Finestra richiesta */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Chiedi una supplenza</div>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              Scegli il giorno in cui non puoi esserci e il collega a cui chiederlo.
              Ricever&agrave; la richiesta e potr&agrave; accettare o rifiutare: se accetta,
              non serve nessun altro passaggio.
            </p>

            <div className="form-group">
              <label className="form-label">Classe *</label>
              <select className="form-control" value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}>
                <option value="">— scegli —</option>
                {classi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Giorno *</label>
              <select className="form-control" value={form.data_id} onChange={e => setForm(f => ({ ...f, data_id: e.target.value }))}>
                <option value="">— scegli —</option>
                {date.map(d => <option key={d.id} value={d.id}>{fmtData(d.data)}</option>)}
              </select>
              {date.length === 0 && (
                <div className="text-xs text-muted" style={{ marginTop: 5 }}>
                  Nessuna data futura disponibile: aggiungile in Catechismo &rarr; Date.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">A chi lo chiedi *</label>
              <select className="form-control" value={form.catechista_supplente_id} onChange={e => setForm(f => ({ ...f, catechista_supplente_id: e.target.value }))}>
                <option value="">— scegli un collega —</option>
                {catechisti.map(c => <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Messaggio (facoltativo)</label>
              <textarea className="form-control" rows={2} value={form.messaggio}
                onChange={e => setForm(f => ({ ...f, messaggio: e.target.value }))}
                placeholder="Es: ho una visita medica, torno sabato prossimo" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline btn-block" onClick={() => setModal(false)}>Annulla</button>
              <button className="btn btn-primary btn-block" onClick={chiedi} disabled={saving}>
                {saving ? 'Invio...' : 'Invia richiesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
