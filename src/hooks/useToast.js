import { useState, useCallback } from 'react'

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'default', duration = 2800) => {
    const id = ++toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const ToastContainer = () => (
    <div
      className="toast-container"
      role="region"
      aria-live="polite"
      aria-label="Notifiche"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          role="alert"
          onClick={() => dismiss(t.id)}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )

  return { toast, ToastContainer }
}
