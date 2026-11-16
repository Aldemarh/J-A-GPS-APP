import { IconExpand, IconMinus, IconPlus } from '../icons.jsx';

function MapButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center text-mute transition hover:bg-white/5 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Controles propios del mapa (iguales con cualquier proveedor): acercar, alejar, ver todos,
 * y el aviso centrado abajo. `children` se pone encima de los botones.
 * z-index por encima de las capas del mapa y por debajo de los modales.
 */
export default function MapControls({
  onZoomIn,
  onZoomOut,
  onFitAll,
  fitDisabled,
  fitLabel = 'Ver todos los vehículos',
  message,
  children,
}) {
  return (
    <>
      <div className="absolute right-3 bottom-8 z-[500] flex flex-col items-end gap-2">
        {children}
        <div className="grid divide-y divide-line overflow-hidden rounded-lg border border-line-2 bg-panel/90">
          <MapButton label="Acercar" onClick={onZoomIn}>
            <IconPlus className="size-4" />
          </MapButton>
          <MapButton label="Alejar" onClick={onZoomOut}>
            <IconMinus className="size-4" />
          </MapButton>
          <MapButton label={fitLabel} onClick={onFitAll} disabled={fitDisabled}>
            <IconExpand className="size-4" />
          </MapButton>
        </div>
      </div>

      {message && (
        <div className="pointer-events-none absolute inset-x-3 bottom-10 z-[500] flex justify-center">
          <p className="max-w-sm rounded-lg border border-line-2 bg-panel/90 px-3 py-2 text-center text-xs text-mute">
            {message}
          </p>
        </div>
      )}
    </>
  );
}
