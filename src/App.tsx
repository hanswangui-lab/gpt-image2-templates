import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthContext'
import { GenerateProvider } from './hooks/GenerateContext'
import AppLayout from './components/AppLayout'

const HomePage = lazy(() => import('./pages/HomePage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const GeneratePage = lazy(() => import('./pages/GeneratePage'))
const GalleryPage = lazy(() => import('./pages/GalleryPage'))
const RechargePage = lazy(() => import('./pages/RechargePage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminAnnouncementsPage = lazy(() => import('./pages/AdminAnnouncementsPage'))
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'))
const CreditHistoryPage = lazy(() => import('./pages/CreditHistoryPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageFallback() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
    <div className="generating-core">
      <div className="generating-orb" />
    </div>
  </div>
}

export default function App() {
  return (
    <AuthProvider>
      <GenerateProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="generate" element={<GeneratePage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="recharge" element={<RechargePage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/announcements" element={<AdminAnnouncementsPage />} />
              <Route path="admin/settings" element={<AdminSettingsPage />} />
              <Route path="credit-history" element={<CreditHistoryPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </GenerateProvider>
    </AuthProvider>
  )
}
