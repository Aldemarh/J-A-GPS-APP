import { VEHICLE_TYPE_LABELS } from './vehicleTypes.js';
import { formatLastSeen } from '../devices/deviceFormat.js';

function GpsLine({ device, position, devicesStatus, canEdit, onOpen }) {
  if (devicesStatus === 'loading') return <p className="mt-1.5 text-xs text-dim">Consultando GPS…</p>;
  if (devicesStatus === 'error') return <p className="mt-1.5 text-xs text-dim">Estado del GPS no disponible</p>;

  const action = (label) => (
    <>
      {' · '}
      <button type="button" onClick={onOpen} className="font-medium text-blue hover:underline">
        {label}
      </button>
    </>
  );

  if (!device) {
    return (
      <p className="mt-1.5 text-xs text-dim">
        Sin dispositivo GPS{canEdit && action('Conectar')}
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-xs text-mute">
      GPS: {device.name} · {formatLastSeen(position?.recordedAt ?? device.lastSeenAt)}
      {action('Ver')}
    </p>
  );
}

export default function VehicleList({
  vehicles,
  status,
  error,
  canEdit,
  deviceByVehicle,
  positionByVehicle,
  devicesStatus,
  onEdit,
  onDelete,
  onOpenDevice,
  onRetry,
}) {
  if (status === 'loading') {
    return <p className="py-6 text-center text-sm text-mute">Cargando vehículos…</p>;
  }

  if (status === 'error') {
    return (
      <div role="alert" className="alert-error">
        <p>{error}</p>
        <button type="button" onClick={onRetry} className="mt-1 font-medium underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-2 px-4 py-10 text-center">
        <p className="font-medium text-fg">Aún no tienes vehículos</p>
        <p className="mt-1 text-sm text-mute">
          {canEdit
            ? 'Agrega tu primer vehículo para comenzar a monitorearlo.'
            : 'El administrador de la cuenta aún no ha registrado vehículos.'}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {vehicles.map((v) => (
        <li key={v.id} className="rounded-xl border border-line bg-ink-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-fg">
                {v.name}
                <span className="ml-2 font-mono text-xs font-normal text-mute">{v.plate}</span>
              </p>
              <p className="mt-0.5 text-sm text-mute">
                {VEHICLE_TYPE_LABELS[v.type] ?? v.type}
                {[v.brand, v.model, v.year].some(Boolean) && (
                  <> · {[v.brand, v.model, v.year].filter(Boolean).join(' ')}</>
                )}
              </p>
              <GpsLine
                device={deviceByVehicle.get(v.id)}
                position={positionByVehicle.get(v.id)}
                devicesStatus={devicesStatus}
                canEdit={canEdit}
                onOpen={() => onOpenDevice(v)}
              />
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(v)}
                  className="rounded-md px-2 py-1 text-sm text-blue hover:bg-blue/10"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(v)}
                  className="rounded-md px-2 py-1 text-sm text-red hover:bg-red/10"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
