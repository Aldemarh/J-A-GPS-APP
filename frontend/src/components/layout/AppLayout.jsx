import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { FleetProvider } from '../../context/FleetContext.jsx';
import Brand from '../Brand.jsx';
import { IconGrid, IconLogout, IconPin } from '../icons.jsx';

// Secciones del menú. Agregar una pantalla = una línea aquí + su ruta en App.jsx.
// Solo se listan las que ya existen (Recorridos, Alertas, Zonas... se suman al construirlas).
const NAV_ITEMS = [
  { to: '/', label: 'Mapa en vivo', Icon: IconPin, end: true },
  { to: '/vehiculos', label: 'Vehículos', Icon: IconGrid },
];

const ROLE_LABELS = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' };

function initials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

const railLinkClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition ${
    isActive ? 'bg-blue/15 text-white' : 'text-mute hover:bg-white/5 hover:text-fg'
  }`;

const tabLinkClass = ({ isActive }) =>
  `flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm transition ${
    isActive ? 'border-blue text-white' : 'border-transparent text-mute hover:text-fg'
  }`;

/**
 * Estructura de las pantallas privadas, como el panel de la landing:
 * menú lateral en escritorio, encabezado con pestañas en celular.
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const accountName = user?.tenant?.name || user?.fullName;

  return (
    <FleetProvider>
      <div className="min-h-screen lg:flex">
        <aside className="hidden border-r border-line bg-rail px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[212px] lg:shrink-0 lg:flex-col">
          <div className="px-1.5 pb-5">
            <Brand />
          </div>
          <nav aria-label="Principal" className="grid gap-0.5">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={railLinkClass}>
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2.5 border-t border-line px-1.5 pt-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink-4 font-mono text-[11px] font-medium text-white"
              aria-hidden="true"
            >
              {initials(accountName)}
            </span>
            <span className="min-w-0 flex-1 text-xs leading-tight">
              <span className="block truncate font-medium text-fg" title={user?.email}>
                {accountName}
              </span>
              <span className="block truncate text-mute">{ROLE_LABELS[user?.role] ?? user?.role}</span>
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-mute transition hover:bg-white/5 hover:text-fg"
            >
              <IconLogout className="size-4" />
            </button>
          </div>
        </aside>

        <header className="border-b border-line bg-rail lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <Brand />
            <button type="button" onClick={logout} className="btn btn-ghost px-2.5 py-1.5">
              <IconLogout className="size-4" />
              Salir
            </button>
          </div>
          <nav aria-label="Principal" className="mt-2 flex gap-1 px-2">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={tabLinkClass}>
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </FleetProvider>
  );
}
