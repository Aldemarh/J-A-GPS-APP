import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import { useTrack } from '../hooks/useTrack.js';
import PageBar from '../components/layout/PageBar.jsx';
import TrackMap from '../components/tracks/TrackMap.jsx';
import TrackPanel, { timelineItems } from '../components/tracks/TrackPanel.jsx';
import { addDays, formatDay, isDayString, todayString } from '../components/tracks/trackFormat.js';
import { IconChevronLeft, IconChevronRight } from '../components/icons.jsx';

const NO_POINTS = [];
const NO_STOPS = [];

function PanelMessage({ children }) {
  return <div className="py-6 text-center text-sm text-mute">{children}</div>;
}

// Recorridos: el trayecto de un vehículo en un día, con su resumen y sus paradas.
// El vehículo y la fecha van en la URL (?vehiculo=…&fecha=AAAA-MM-DD): se pueden compartir y
// el botón Atrás del navegador vuelve a la selección anterior.
export default function TracksPage() {
  const { user } = useAuth();
  const { vehicles, devices } = useFleet();
  const [params, setParams] = useSearchParams();
  const today = todayString();

  const list = vehicles.vehicles;
  const withGps = new Set(devices.devices.map((d) => d.vehicleId));
  const requestedId = params.get('vehiculo');
  // Sin vehículo en la URL (o uno que ya no existe): el primero con GPS, o el primero.
  const vehicle =
    list.find((v) => v.id === requestedId) ?? list.find((v) => withGps.has(v.id)) ?? list[0] ?? null;
  const requestedDay = params.get('fecha');
  const day = isDayString(requestedDay) && requestedDay <= today ? requestedDay : today;
  const live = day === today;

  const track = useTrack(vehicle?.id, day, { live });
  const data = track.data;
  const endLabel = live ? 'Último dato' : 'Fin';
  const items = useMemo(() => (data ? timelineItems(data, endLabel) : []), [data, endLabel]);

  const [selected, setSelected] = useState(null);
  // { point }: objeto nuevo en cada pedido, para que el mapa vuele aunque se repita el punto.
  const [focus, setFocus] = useState(null);
  const trackKey = `${vehicle?.id}|${day}`;
  useEffect(() => {
    setSelected(null);
    setFocus(null);
  }, [trackKey]);

  function choose(next) {
    const merged = { vehiculo: vehicle?.id, fecha: day, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
  }

  function selectItem(item) {
    setSelected(item.key);
    setFocus({ point: item.point });
  }

  // Desde el mapa: se marca en la línea de tiempo sin mover el mapa (el usuario ya está mirando ahí).
  const selectFromMap = (key) => setSelected(key);

  const fleetLoading = vehicles.status === 'loading' || devices.status === 'loading';
  const fleetError = vehicles.status === 'error' ? vehicles.error : null;
  const hasPoints = data?.points.length > 0;

  let mapMessage = null;
  if (vehicle && track.status === 'loading') mapMessage = 'Cargando recorrido…';
  else if (track.status === 'ready' && !hasPoints) {
    mapMessage = withGps.has(vehicle.id) ? 'Sin recorridos este día.' : 'Este vehículo no tiene GPS conectado.';
  }

  let panel;
  if (fleetLoading) {
    panel = <PanelMessage>Cargando vehículos…</PanelMessage>;
  } else if (!vehicle) {
    panel = (
      <PanelMessage>
        <p className="font-medium text-fg">Aún no tienes vehículos</p>
        {user?.role === 'owner' || user?.role === 'admin' ? (
          <Link to="/vehiculos" className="mt-2 inline-block font-medium text-blue hover:underline">
            Agregar el primero
          </Link>
        ) : (
          <p className="mt-1">El administrador de la cuenta aún no ha registrado vehículos.</p>
        )}
      </PanelMessage>
    );
  } else if (track.status === 'error') {
    panel = (
      <div role="alert" className="alert-error">
        <p>{track.error}</p>
        <button type="button" onClick={track.retry} className="mt-1 font-medium underline">
          Reintentar
        </button>
      </div>
    );
  } else if (track.status !== 'ready') {
    panel = <PanelMessage>Cargando recorrido…</PanelMessage>;
  } else if (!hasPoints) {
    panel = (
      <PanelMessage>
        <p className="font-medium text-fg">Sin recorridos este día</p>
        <p className="mt-1">
          {withGps.has(vehicle.id) ? (
            'El GPS no envió ubicaciones en esta fecha.'
          ) : (
            <>
              Conecta su GPS en{' '}
              <Link to="/vehiculos" className="font-medium text-blue hover:underline">
                Vehículos
              </Link>{' '}
              para empezar a guardar recorridos.
            </>
          )}
        </p>
      </PanelMessage>
    );
  } else {
    panel = <TrackPanel data={data} items={items} selected={selected} onSelect={selectItem} />;
  }

  return (
    <div className="flex flex-1 flex-col lg:h-screen lg:min-h-[560px]">
      <PageBar title="Recorridos">
        {list.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
            {/* En celular el vehículo ocupa su propia fila y las fechas van debajo. */}
            <label className="min-w-0 basis-full sm:max-w-[260px] sm:flex-1 sm:basis-auto">
              <span className="sr-only">Vehículo</span>
              <select
                value={vehicle?.id ?? ''}
                onChange={(e) => choose({ vehiculo: e.target.value })}
                className="input py-1.5 text-[13px]"
              >
                {list.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.plate}
                    {withGps.has(v.id) ? '' : ' (sin GPS)'}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => choose({ fecha: addDays(day, -1) })}
                aria-label="Día anterior"
                title="Día anterior"
                className="btn btn-ghost size-8 p-0"
              >
                <IconChevronLeft className="size-4" />
              </button>
              <label>
                <span className="sr-only">Fecha</span>
                <input
                  type="date"
                  value={day}
                  max={today}
                  onChange={(e) => isDayString(e.target.value) && choose({ fecha: e.target.value })}
                  className="input w-[150px] py-1.5 font-mono text-[13px]"
                />
              </label>
              <button
                type="button"
                onClick={() => choose({ fecha: addDays(day, 1) })}
                disabled={live}
                aria-label="Día siguiente"
                title="Día siguiente"
                className="btn btn-ghost size-8 p-0"
              >
                <IconChevronRight className="size-4" />
              </button>
              {!live && (
                <button type="button" onClick={() => choose({ fecha: today })} className="btn btn-ghost px-2.5 py-1.5 text-xs">
                  Hoy
                </button>
              )}
            </div>
          </div>
        )}
      </PageBar>

      {fleetError && (
        <div role="alert" className="alert-error m-4 mb-0">
          <p>{fleetError}</p>
          <button type="button" onClick={vehicles.reload} className="mt-1 font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        {/* En celular el mapa va primero; en escritorio queda a la derecha. */}
        <section aria-label="Mapa del recorrido" className="relative h-[52vh] min-h-[320px] lg:order-2 lg:h-auto lg:min-h-0">
          <TrackMap
            points={data?.points ?? NO_POINTS}
            stops={data?.stops ?? NO_STOPS}
            fitKey={trackKey}
            selected={selected}
            onSelect={selectFromMap}
            focus={focus}
            endLabel={endLabel}
            message={mapMessage}
          />
        </section>

        <aside aria-label="Resumen del recorrido" className="border-line p-4 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          {vehicle && (
            <header className="mb-4">
              <h2 className="truncate text-[15px] font-semibold text-fg">{vehicle.name}</h2>
              <p className="font-mono text-[11px] text-mute">
                {vehicle.plate} · {formatDay(day)}
                {live && <span className="text-green"> · hoy</span>}
              </p>
            </header>
          )}
          {panel}
        </aside>
      </div>
    </div>
  );
}
