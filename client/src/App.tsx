import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider }      from './context/AuthContext'
import { SavedProvider }     from './context/SavedContext'
import { CityProvider }      from './context/CityContext'
import { ToastProvider }     from './context/ToastContext'
import { ErrorBoundary }     from './components/ErrorBoundary'
import BottomNav             from './components/BottomNav'
import { SkeletonGrid }      from './components/Skeleton'
import { useOAuthDeepLink }  from './hooks/useOAuthDeepLink'
import { useReminderTaps }   from './hooks/useReminderTaps'

// ─── Lazy-loaded page components ─────────────────────────────────────────────
// Each page is split into its own JS chunk and loaded only when first visited.

const MapPage          = lazy(() => import('./pages/MapPage'))
const DiscoverPage     = lazy(() => import('./pages/DiscoverPage'))
const ExhibitionDetailPage  = lazy(() => import('./pages/ExhibitionDetailPage'))
const VenueDetailPage  = lazy(() => import('./pages/VenueDetailPage'))
const FavoritesPage    = lazy(() => import('./pages/FavoritesPage'))
const ProfilePage      = lazy(() => import('./pages/ProfilePage'))
const LoginPage        = lazy(() => import('./pages/LoginPage'))
const RegisterPage     = lazy(() => import('./pages/RegisterPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const NotFoundPage     = lazy(() => import('./pages/NotFoundPage'))

// ─── Page-level loading fallback ─────────────────────────────────────────────

function PageFallback() {
  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <SkeletonGrid count={6} />
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  // Mounted here rather than on the login page: the OAuth callback can arrive
  // while any route is showing, or after the app has been backgrounded.
  useOAuthDeepLink()

  // Same reasoning: a tapped closing reminder must reach its exhibition even
  // when the tap is what launched the app.
  useReminderTaps()

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SavedProvider>
            <CityProvider>
              <div className="flex flex-col min-h-screen bg-gray-50">
                <main className="flex-1 pb-[var(--nav-h)]">
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/"              element={<MapPage />} />
                      <Route path="/discover"      element={<DiscoverPage />} />
                      <Route path="/exhibition/:id" element={<ExhibitionDetailPage />} />
                      {/* Deprecated: shared links and older builds use /event. */}
                      <Route path="/event/:id"      element={<ExhibitionDetailPage />} />
                      <Route path="/venue/:id"     element={<VenueDetailPage />} />
                      <Route path="/favorites"     element={<FavoritesPage />} />
                      <Route path="/profile"       element={<ProfilePage />} />
                      <Route path="/login"         element={<LoginPage />} />
                      <Route path="/register"      element={<RegisterPage />} />
                      <Route path="/auth/callback" element={<AuthCallbackPage />} />
                      {/* 404 — catch all unknown routes */}
                      <Route path="*"             element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </main>

                <BottomNav />
              </div>
            </CityProvider>
          </SavedProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
