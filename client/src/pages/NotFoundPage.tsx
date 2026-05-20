import { useNavigate } from 'react-router-dom'
import { useTitle } from '../hooks/useTitle'

export default function NotFoundPage() {
  const navigate = useNavigate()
  useTitle('Page not found', 'The page you were looking for does not exist.')

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] bg-gray-50 px-8 text-center">
      {/* Big 404 */}
      <p className="text-8xl font-black text-gray-100 leading-none mb-2 select-none">404</p>

      {/* Illustration */}
      <svg
        className="w-32 h-32 mb-6 opacity-40"
        viewBox="0 0 128 128"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="64" cy="64" r="56" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="8 5" />
        {/* Compass */}
        <circle cx="64" cy="64" r="24" stroke="#9CA3AF" strokeWidth="2.5" />
        <path
          d="M64 44v4M64 80v4M44 64h4M80 64h4"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M64 52l4 12-4 4-4-4 4-12z" fill="#6B7280" />
        <path d="M64 76l-4-12 4-4 4 4-4 12z" fill="#D1D5DB" />
      </svg>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h1>
      <p className="text-sm text-gray-400 max-w-xs mb-8 leading-relaxed">
        We couldn't find what you were looking for. The link might be broken or the page may have moved.
      </p>

      <button
        onClick={() => navigate('/discover')}
        className="h-12 px-8 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors active:scale-[0.98]"
      >
        Back to Discover
      </button>

      <button
        onClick={() => navigate(-1)}
        className="mt-3 h-12 px-8 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
      >
        Go back
      </button>
    </div>
  )
}
