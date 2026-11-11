import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Protege rutas privadas: sin sesión, redirige a /login.
export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenMessage text="Verificando sesión..." />;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function FullScreenMessage({ text }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">{text}</div>
  );
}
