import { FLEET_STATUS } from './fleetStatus.js';

// Punto + nombre del estado en su color, como en la lista de la landing.
export default function StatusText({ status, suffix, className = '' }) {
  const meta = FLEET_STATUS[status];
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} style={{ color: meta.text }}>
      <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      <span className="truncate">
        {meta.label}
        {suffix && <span className="text-dim">{suffix}</span>}
      </span>
    </span>
  );
}
