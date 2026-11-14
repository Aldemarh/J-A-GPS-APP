import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import { ApiError } from '../api/client.js';
import PageBar from '../components/layout/PageBar.jsx';
import VehicleList from '../components/vehicles/VehicleList.jsx';
import VehicleFormModal from '../components/vehicles/VehicleFormModal.jsx';
import DeviceModal from '../components/devices/DeviceModal.jsx';
import { IconPlus } from '../components/icons.jsx';

// Gestión de vehículos: alta, edición, eliminación y conexión del GPS.
export default function VehiclesPage() {
  const { user } = useAuth();
  const { vehicles: fleet, devices, latest } = useFleet();
  const { vehicles, status, error, reload, create, update, remove } = fleet;
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
    <div className="flex flex-1 flex-col">
      <PageBar title="Vehículos">
        {status === 'ready' && vehicles.length > 0 && (
          <span className="font-mono text-[11px] text-mute">
            {vehicles.length} {vehicles.length === 1 ? 'registrado' : 'registrados'}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setNotice('');
              setEditing('new');
            }}
            className="btn btn-primary ml-auto px-3 py-1.5"
          >
            <IconPlus className="size-4" />
            Agregar
          </button>
        )}
      </PageBar>

      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        {notice && (
          <p role="status" className="notice mb-3">
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
      </div>

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
