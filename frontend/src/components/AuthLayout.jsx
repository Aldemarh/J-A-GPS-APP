import Brand from './Brand.jsx';

// Contenedor visual compartido por login y registro, con el fondo grafito de la landing.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink bg-[radial-gradient(ellipse_at_top,rgb(76_141_255/0.14),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand size="lg" />
        </div>
        <div className="rounded-2xl border border-line-2 bg-ink-2 p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-mute">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
