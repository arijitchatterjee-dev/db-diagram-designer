import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectEditorPage from './pages/ProjectEditorPage';
import PlanPage from './pages/PlanPage';
import PlanWizardPage from './pages/PlanWizardPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // One /auth/me call on load tells us whether the cookie is still valid.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/project/:id" element={<ProjectEditorPage />} />
          <Route path="/project/:id/plan" element={<PlanPage />} />
          <Route path="/project/:id/plan/wizard" element={<PlanWizardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
