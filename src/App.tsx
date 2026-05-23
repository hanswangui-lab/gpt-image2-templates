import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthContext'
import { GenerateProvider } from './hooks/GenerateContext'
import AppLayout from './components/AppLayout'
import HomePage from './pages/HomePage'
import TemplatesPage from './pages/TemplatesPage'
import GeneratePage from './pages/GeneratePage'
import GalleryPage from './pages/GalleryPage'
import RechargePage from './pages/RechargePage'
import PricingPage from './pages/PricingPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminAnnouncementsPage from './pages/AdminAnnouncementsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import CreditHistoryPage from './pages/CreditHistoryPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsPage from './pages/TermsPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <AuthProvider>
      <GenerateProvider>
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
      </GenerateProvider>
    </AuthProvider>
  )
}
