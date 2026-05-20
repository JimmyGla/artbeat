import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
}

/**
 * Catches unhandled React render errors and shows a friendly recovery screen.
 * Must be a class component — React's getDerivedStateFromError API requires it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-8 text-center">
        {/* Illustration */}
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-8 leading-relaxed">
          An unexpected error occurred. This has been noted. Try reloading the page.
        </p>

        {/* Error detail (dev mode hint) */}
        {import.meta.env.DEV && this.state.error && (
          <pre className="text-left text-xs bg-red-50 text-red-700 rounded-xl p-4 mb-6 max-w-sm overflow-x-auto w-full">
            {this.state.error.message}
          </pre>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={this.handleReload}
            className="h-12 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Reload page
          </button>
          <button
            onClick={this.handleReset}
            className="h-12 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Try to recover
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
