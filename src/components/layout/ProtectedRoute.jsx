import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  // Wait for the initial session check before deciding — otherwise a refresh
  // would flash the login page for an already-authenticated user.
  if (status === 'loading') {
    return (
      <div className="center">
        <CircleNotch size={20} weight="bold" className="spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
