import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import { useNow } from '../hooks/useNow.js';
import PageBar from '../components/layout/PageBar.jsx';
import FleetMap from '../components/map/FleetMap.jsx';
import MapChips from '../components/fleet/MapChips.jsx';
import VehicleRail from '../components/fleet/VehicleRail.jsx';
import VehicleDetail, { FleetOverview } from '../components/fleet/VehicleDetail.jsx';
import { IconSearch } from '../components/icons.jsx';
import {
  FLEET_STATUS,
  buildFleetRows,
  countByStatus,
  isOnline,
  matchesSearch,
} from '../components/fleet/fleetStatus.js';

// Cada cuánto se recalculan los estados que dependen del tiempo ("sin señal", "hace 5 min").
const CLOCK_TICK_MS = 15_000;

const pointOf = (position) => [position.latitude, position.longitude];

function ListMessage({ children }) {
  return <div className="px-3 py-8 text-center text-sm text-mute">{children}</div>;
}

// "En vivo" mientras las consultas responden; avisa si se cortan.
function LiveIndicator({ status, updatedAt }) {
  const states = {
    loading: { text: 'Conectando', dot: 'bg-dim' },
    ready: { text: 'En vivo', dot: 'bg-green live-dot' },
    error: { text: 'Reconectando', dot: 'bg-amber' },
  };
  const { text, dot } = states[status];
  const time = updatedAt?.toLocaleTimeString('es-CO', { timeStyle: 'medium' });
  return (
    <span className="flex items-center gap-1.5" title={time ? `Última actualización: ${time}` : undefined}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

// Mapa en vivo: lista de vehículos, mapa y detalle del seleccionado (como el panel de la landing).
export default function DashboardPage() {
  const { user } = useAuth();
  const { vehicles, devices, latest } = useFleet();
  const now = useNow(CLOCK_TICK_MS);
  // 'all' o una clave de FLEET_STATUS
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  // { point }: objeto nuevo en cada pedido de "centrar", para que el mapa vuele aunque se repita.
  const [focus, setFocus] = useState(null);
  const mapRef = useRef(null);

  const rows = useMemo(
    () => buildFleetRows(vehicles.vehicles, devices.devices, latest.positions, now),
    [vehicles.vehicles, devices.devices, latest.positions, now],
  );
  const counts = useMemo(() => countByStatus(rows), [rows]);
  const allPoints = useMemo(() => rows.filter((r) => r.position).map((r) => pointOf(r.position)), [rows]);
  const visibleRows = rows.filter(
    (r) => (filter === 'all' || r.status === filter) && matchesSearch(r.vehicle, query),
  );
  const selectedRow = rows.find((r) => r.vehicle.id === selectedId) ?? null;
  const onlineCount = rows.filter((r) => isOnline(r.status)).length;

  // Sin las tres fuentes no se puede calcular el estado: se muestra "—" en vez de cifras falsas.
  const loadError =
    (vehicles.status === 'error' && { message: vehicles.error, retry: vehicles.reload }) ||
    (devices.status === 'error' && { message: devices.error, retry: devices.reload }) ||
    (latest.status === 'error' &&
      !latest.updatedAt && { message: 'No se pudieron cargar las ubicaciones. Se reintentará automáticamente.' });
  const loading = [vehicles.status, devices.status, latest.status].includes('loading');
  const ready = !loading && !loadError;
  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const filtered = filter !== 'all' || query.trim() !== '';

  function selectFromList(row) {
    setSelectedId(row.vehicle.id);
    if (!row.position) return;
    setFocus({ point: pointOf(row.position) });
    // En celular la lista va debajo del mapa: se sube para ver el mapa volar hasta el vehículo.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  let mapMessage = null;
  if (latest.status === 'error' && latest.updatedAt) {
    mapMessage = 'No se pudieron actualizar las ubicaciones. Reintentando…';
  } else if (ready && rows.length === 0) {
    mapMessage = 'Registra tu primer vehículo para verlo aquí.';
  } else if (ready && allPoints.length === 0) {
    mapMessage = 'Aún no hay ubicaciones: aparecerán cuando el GPS del vehículo envíe datos.';
  } else if (ready && filtered && !visibleRows.some((r) => r.position)) {
    mapMessage = 'Ningún vehículo en el mapa coincide con el filtro.';
  }

  let list;
  if (!ready) {
    list = <ListMessage>{loading ? 'Cargando vehículos…' : 'Estado no disponible.'}</ListMessage>;
  } else if (rows.length === 0) {
    list = (
      <ListMessage>
        <p className="font-medium text-fg">Aún no tienes vehículos</p>
        {canEdit ? (
          <Link to="/vehiculos" className="mt-2 inline-block font-medium text-blue hover:underline">
            Agregar el primero
          </Link>
        ) : (
          <p className="mt-1">El administrador de la cuenta aún no ha registrado vehículos.</p>
        )}
      </ListMessage>
    );
  } else if (visibleRows.length === 0) {
    list = <ListMessage>Ningún vehículo coincide.</ListMessage>;
  } else {
    list = <VehicleRail rows={visibleRows} now={now} selectedId={selectedId} onSelect={selectFromList} />;
  }

  const detail = selectedRow && (
    <VehicleDetail
      row={selectedRow}
      now={now}
      canEdit={canEdit}
      onCenter={() => selectedRow.position && setFocus({ point: pointOf(selectedRow.position) })}
      onClose={() => setSelectedId(null)}
    />
  );

  return (
    <div className="flex flex-1 flex-col lg:h-screen lg:min-h-[560px]">
      <PageBar title="Mapa en vivo">
        {/* En celular el buscador baja a su propia fila; desde sm va junto al título. */}
        <label className="relative order-last flex w-full items-center sm:order-none sm:w-auto sm:max-w-[260px] sm:min-w-0 sm:flex-1">
          <span className="sr-only">Buscar placa o vehículo</span>
          <IconSearch className="pointer-events-none absolute left-2.5 size-3.5 text-dim" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa o vehículo"
            className="input py-1.5 pl-8 text-[13px]"
          />
        </label>
        <p className="ml-auto flex items-center gap-3 font-mono text-[11px] text-mute">
          <LiveIndicator status={latest.status} updatedAt={latest.updatedAt} />
          {ready && (
            <span className="hidden sm:inline">
              {rows.length} {rows.length === 1 ? 'vehículo' : 'vehículos'} · {onlineCount} en línea
            </span>
          )}
        </p>
      </PageBar>

      {loadError && (
        <div role="alert" className="alert-error m-4 mb-0">
          <p>{loadError.message}</p>
          {loadError.retry && (
            <button type="button" onClick={loadError.retry} className="mt-1 font-medium underline">
              Reintentar
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[264px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_280px]">
        {/* En celular el mapa va primero; en escritorio queda en la columna central. */}
        <section
          ref={mapRef}
          aria-label="Mapa"
          className="relative h-[58vh] min-h-[340px] lg:order-2 lg:h-auto lg:min-h-0"
        >
          <FleetMap
            rows={visibleRows}
            allPoints={allPoints}
            selectedId={selectedId}
            focus={focus}
            onSelect={setSelectedId}
            message={mapMessage}
          />
          <MapChips counts={counts} ready={ready} filter={filter} onFilter={setFilter} />
        </section>

        <aside aria-label="Vehículos" className="flex flex-col border-line lg:order-1 lg:min-h-0 lg:border-r">
          {/* Hasta xl no hay columna derecha: el detalle va encima de la lista. */}
          {detail && <div className="border-b border-line p-4 xl:hidden">{detail}</div>}
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
            <span className="eyebrow">
              {filter === 'all' ? 'Vehículos' : FLEET_STATUS[filter].label}
              {ready && <span className="ml-2">{visibleRows.length}</span>}
            </span>
            {filter !== 'all' && (
              <button type="button" onClick={() => setFilter('all')} className="text-xs text-blue hover:underline">
                Ver todos
              </button>
            )}
          </div>
          <div className="px-2 pb-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{list}</div>
        </aside>

        <aside
          aria-label="Detalle"
          className="hidden min-h-0 flex-col overflow-y-auto border-l border-line p-4 xl:order-3 xl:flex"
        >
          {detail || <FleetOverview counts={counts} ready={ready} updatedAt={latest.updatedAt} />}
        </aside>
      </div>
    </div>
  );
}
