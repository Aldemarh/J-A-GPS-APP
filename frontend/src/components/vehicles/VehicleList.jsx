import { VEHICLE_TYPE_LABELS } from './vehicleTypes.js';
import { formatLastSeen } from '../devices/deviceFormat.js';

function GpsLine({ device, position, devicesStatus, canEdit, onOpen }) {
  if (devicesStatus === 'loading') return <p className="mt-1 text-xs text-slate-400">Consultando GPS...</p>;
  if (devicesStatus === 'error') return <p className="mt-1 text-xs text-slate-400">Estado del GPS no disponible</p>;

  const action = (label) => (
    <>
      {' · '}
      <button type="button" onClick={onOpen} className="font-semibold text-brand-600 hover:underline">
        {label}
      </button>
    </>
  );

  if (!device) {
    return (
      <p className="mt-1 text-xs text-slate-400">
        Sin dispositivo GPS{canEdit && action('Conectar')}
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-slate-500">
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
    return <p className="py-6 text-center text-sm text-slate-500">Cargando vehículos...</p>;
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
        <p>{error}</p>
        <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
        <p className="font-medium text-slate-700">Aún no tienes vehículos</p>
        <p className="mt-1 text-sm text-slate-500">
          {canEdit ? 'Agrega tu primer vehículo para comenzar a monitorearlo.' : 'El administrador de la cuenta aún no ha registrado vehículos.'}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {vehicles.map((v) => (
        <li key={v.id} className="rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{v.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {v.plate}
                </span>{' '}
                · {VEHICLE_TYPE_LABELS[v.type] ?? v.type}
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
                  className="rounded-md px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(v)}
                  className="rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
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
