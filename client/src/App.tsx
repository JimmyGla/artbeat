import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider }      from './context/AuthContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { CityProvider }      from './context/CityContext'
import { ToastProvider }     from './context/ToastContext'
import { ErrorBoundary }     from './components/ErrorBoundary'
import BottomNav             from './components/BottomNav'
import { SkeletonGrid }      from './components/Skeleton'

// ─── Lazy-loaded page components ─────────────────────────────────────────────
// Each page is split into its own JS chunk and loaded only when first visited.

const MapPage          = lazy(() => import('./pages/MapPage'))
const DiscoverPage     = lazy(() => import('./pages/DiscoverPage'))
const EventDetailPage  = lazy(() => import('./pages/EventDetailPage'))
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
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <FavoritesProvider>
            <CityProvider>
              <div className="flex flex-col min-h-screen bg-gray-50">
                <main className="flex-1 pb-16">
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/"              element={<MapPage />} />
                      <Route path="/discover"      element={<DiscoverPage />} />
                      <Route path="/event/:id"     element={<EventDetailPage />} />
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
          </FavoritesProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
