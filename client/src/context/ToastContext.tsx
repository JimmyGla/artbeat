import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'default' | 'success' | 'error'

interface Toast {
  id:      number
  message: string
  type:    ToastType
  /** true once the dismiss animation starts */
  leaving: boolean
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null)

// ─── Colours ──────────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, string> = {
  default: 'bg-gray-900 text-white',
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600   text-white',
}

const TOAST_ICON: Record<ToastType, string> = {
  default: '',
  success: '✓',
  error:   '✕',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000
const LEAVE_ANIM_MS   = 300
let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    // Mark as leaving (triggers fade-out animation)
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    )
    // Remove from DOM after animation
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timers.current.delete(id)
    }, LEAVE_ANIM_MS)
    timers.current.set(id, removeTimer)
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'default') => {
      const id = nextId++
      setToasts((prev) => {
        // Keep max 3 toasts
        const kept = prev.length >= 3 ? prev.slice(-2) : prev
        return [...kept, { id, message, type, leaving: false }]
      })
      // Auto-dismiss
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ── Toast container ─────────────────────────────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-20 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              'pointer-events-auto flex items-center gap-2',
              'px-4 py-3 rounded-2xl shadow-lg',
              'text-sm font-medium max-w-sm w-full',
              TOAST_STYLES[toast.type],
              toast.leaving
                ? 'opacity-0 translate-y-2 transition-all duration-300'
                : 'opacity-100 translate-y-0 transition-all duration-300',
            ].join(' ')}
          >
            {TOAST_ICON[toast.type] && (
              <span className="shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {TOAST_ICON[toast.type]}
              </span>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
