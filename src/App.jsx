import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import './index.css'

// Layout
import Layout from './components/layout/Layout'

// Pagine
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'

// Admin
import AdminAttivita from './pages/admin/Attivita'

// Catechismo
import CatClassi from './pages/catechismo/Classi'
import CatBambini from './pages/catechismo/Bambini'
import CatPresenze from './pages/catechismo/Presenze'
import CatDate from './pages/catechismo/Date'
import CatUtenti from './pages/catechismo/Utenti'
import CatSupplenze from './pages/catechismo/Supplenze'
import CatReport from './pages/catechismo/ReportPresenze'
import Bacheca from './pages/catechismo/Bacheca'

// Comitato
import ComCalendario from './pages/comitato/Calendario'
import ComLettere from './pages/comitato/Lettere'
import ComRubrica from './pages/comitato/Rubrica'

// Coro
import CoroCanti from './pages/coro/Canti'
import CoroCoristi from './pages/coro/Coristi'

// Neocatecumenali
import NeoComunit from './pages/neocatecumenali/Comunita'
import NeoStanze from './pages/neocatecumenali/Stanze'
import NeoAvvisi from './pages/neocatecumenali/Avvisi'

function ProtectedRoute({ children, ruoli }) {
  const { user, tuttiRuoli, loading } = useAuth()
  if (loading) return <div className="loader"><div className="spinner" />Caricamento…</div>
  if (!user) return <Navigate to="/login" replace />
  const isSuperUser = ['admin', 'parroco', 'responsabile'].some(r => tuttiRuoli.includes(r))
  if (ruoli && !isSuperUser && !ruoli.some(r => tuttiRuoli.includes(r))) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, recoveryMode } = useAuth()

  // Se l'utente ha cliccato un link di reset password, mostra subito la pagina
  if (recoveryMode) return <ResetPassword />

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        {/* Catechismo */}
        <Route path="catechismo/classi"   element={<ProtectedRoute ruoli={['admin','parroco','segreteria','catechista']}><CatClassi /></ProtectedRoute>} />
        <Route path="catechismo/bambini"  element={<ProtectedRoute ruoli={['admin','parroco','segreteria','catechista']}><CatBambini /></ProtectedRoute>} />
        <Route path="catechismo/presenze" element={<ProtectedRoute ruoli={['admin','parroco','segreteria','catechista']}><CatPresenze /></ProtectedRoute>} />
        <Route path="catechismo/date"     element={<ProtectedRoute ruoli={['admin','parroco','segreteria']}><CatDate /></ProtectedRoute>} />
        <Route path="catechismo/supplenze" element={<ProtectedRoute ruoli={['admin','parroco','segreteria']}><CatSupplenze /></ProtectedRoute>} />
        <Route path="catechismo/report"    element={<ProtectedRoute ruoli={['admin','parroco','segreteria','catechista']}><CatReport /></ProtectedRoute>} />
        <Route path="bacheca"              element={<ProtectedRoute><Bacheca /></ProtectedRoute>} />
        {/* Admin — Utenti (vecchio path reindirizzato) */}
        <Route path="catechismo/utenti"    element={<Navigate to="/admin/utenti" replace />} />
        <Route path="admin/utenti"         element={<ProtectedRoute ruoli={['admin','parroco','segreteria']}><CatUtenti /></ProtectedRoute>} />
        <Route path="admin/attivita"       element={<ProtectedRoute ruoli={['admin','parroco']}><AdminAttivita /></ProtectedRoute>} />
        {/* Comitato */}
        <Route path="comitato/calendario" element={<ProtectedRoute ruoli={['admin','parroco','comitato']}><ComCalendario /></ProtectedRoute>} />
        <Route path="comitato/lettere"    element={<ProtectedRoute ruoli={['admin','parroco','comitato']}><ComLettere /></ProtectedRoute>} />
        <Route path="comitato/rubrica"    element={<ProtectedRoute ruoli={['admin','parroco','comitato']}><ComRubrica /></ProtectedRoute>} />
        {/* Coro */}
        <Route path="coro/canti"   element={<ProtectedRoute ruoli={['admin','parroco','responsabile_coro','corista','neocatecumenale','responsabile_neo','comitato','segreteria','catechista']}><CoroCanti /></ProtectedRoute>} />
        <Route path="coro/coristi" element={<ProtectedRoute ruoli={['admin','parroco','responsabile_coro']}><CoroCoristi /></ProtectedRoute>} />
        {/* Neocatecumenali */}
        <Route path="neo/comunita" element={<ProtectedRoute ruoli={['admin','parroco','neocatecumenale','responsabile_neo']}><NeoComunit /></ProtectedRoute>} />
        <Route path="neo/stanze"   element={<ProtectedRoute ruoli={['admin','parroco','neocatecumenale','responsabile_neo']}><NeoStanze /></ProtectedRoute>} />
        <Route path="neo/avvisi"   element={<ProtectedRoute ruoli={['admin','parroco','neocatecumenale','responsabile_neo']}><NeoAvvisi /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
