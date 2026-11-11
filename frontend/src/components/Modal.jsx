import { useEffect, useId } from 'react';

/**
 * Ventana modal accesible. Se cierra con Escape o clic en el fondo, salvo con closeDisabled.
 * z-index por encima de los controles de Leaflet (1000).
 */
export default function Modal({ title, onClose, closeDisabled = false, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !closeDisabled && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, closeDisabled]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !closeDisabled && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
