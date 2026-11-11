import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useVehicles } from '../hooks/useVehicles.js';
import { useDevices } from '../hooks/useDevices.js';
import { useLatestPositions } from '../hooks/useLatestPositions.js';
import { ApiError } from '../api/client.js';
import FleetMap from '../components/map/FleetMap.jsx';
import VehicleList from '../components/vehicles/VehicleList.jsx';
import VehicleFormModal from '../components/vehicles/VehicleFormModal.jsx';
import DeviceModal from '../components/devices/DeviceModal.jsx';

// Panel principal: lista de vehículos de la cuenta + mapa.
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { vehicles, status, error, reload, create, update, remove } = useVehicles();
  const devices = useDevices();
  const latest = useLatestPositions();
  // null = cerrado, 'new' = crear, objeto = editar
  const [editing, setEditing] = useState(null);
  // Vehículo cuya ventana de GPS está abierta
  const [gpsVehicle, setGpsVehicle] = useState(null);
  const [notice, setNotice] = useState('');

  const deviceByVehicle = useMemo(
    () => new Map(devices.devices.map((d) => [d.vehicleId, d])),
    [devices.devices],
  );
  const positionByVehicle = useMemo(
    () => new Map(latest.positions.map((p) => [p.vehicleId, p])),
    [latest.positions],
  );

  const canEdit = user?.role === 'owner' || user?.role === 'admin';

  async function handleSubmit(payload) {
    if (editing === 'new') {
      await create(payload);
      setNotice('Vehículo agregado.');
    } else {
      await update(editing.id, payload);
      setNotice('Cambios guardados.');
    }
    setEditing(null);
  }

  async function handleDelete(vehicle) {
    const gpsNote = deviceByVehicle.has(vehicle.id) ? ' También se eliminará su dispositivo GPS.' : '';
    if (!window.confirm(`¿Eliminar "${vehicle.name}" (${vehicle.plate})?${gpsNote} Esta acción no se puede deshacer.`)) return;
    try {
      await remove(vehicle.id);
      devices.forgetVehicle(vehicle.id);
      setNotice('Vehículo eliminado.');
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo eliminar el vehículo.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm sm:px-6">
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

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <section className="flex w-full flex-col lg:w-96 lg:shrink-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              Mis vehículos{status === 'ready' && vehicles.length > 0 && (
                <span className="ml-1 font-normal text-slate-500">({vehicles.length})</span>
              )}
            </h1>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setNotice('');
                  setEditing('new');
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-brand-700"
              >
                + Agregar
              </button>
            )}
          </div>

          {notice && (
            <p role="status" className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {notice}
            </p>
          )}

          <VehicleList
            vehicles={vehicles}
            status={status}
            error={error}
            canEdit={canEdit}
            deviceByVehicle={deviceByVehicle}
            positionByVehicle={positionByVehicle}
            devicesStatus={devices.status}
            onEdit={(v) => {
              setNotice('');
              setEditing(v);
            }}
            onDelete={handleDelete}
            onOpenDevice={(v) => {
              setNotice('');
              setGpsVehicle(v);
            }}
            onRetry={reload}
          />
        </section>

        <section className="h-[55vh] flex-1 lg:h-auto">
          <FleetMap
            vehicles={vehicles}
            vehiclesStatus={status}
            positions={latest.positions}
            positionsStatus={latest.status}
          />
        </section>
      </main>

      {editing && (
        <VehicleFormModal
          vehicle={editing === 'new' ? null : editing}
          onSubmit={handleSubmit}
          onClose={() => setEditing(null)}
        />
      )}

      {gpsVehicle && (
        <DeviceModal
          vehicle={gpsVehicle}
          device={deviceByVehicle.get(gpsVehicle.id)}
          lastPositionAt={positionByVehicle.get(gpsVehicle.id)?.recordedAt}
          canEdit={canEdit}
          onCreate={devices.create}
          onRemove={async (device) => {
            await devices.remove(device.id);
            setGpsVehicle(null);
            setNotice('Dispositivo GPS eliminado.');
          }}
          onClose={() => setGpsVehicle(null)}
        />
      )}
    </div>
  );
}
