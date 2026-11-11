import { useAuth } from '../context/AuthContext.jsx';

// Pantalla inicial tras iniciar sesión. Los módulos de vehículos y mapa llegarán en las siguientes etapas.
export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-brand-600">J&amp;A GPS</p>
          <p className="text-xs text-slate-500">
            {user?.tenant?.name ? `Cuenta: ${user.tenant.name}` : 'Panel principal'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-600 sm:inline">{user?.fullName}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Hola, {user?.fullName}</h1>
        <p className="mt-2 text-slate-600">
          Sesión iniciada correctamente. Próximamente aquí verás tus vehículos y su ubicación en el mapa.
        </p>
      </main>
    </div>
  );
}
