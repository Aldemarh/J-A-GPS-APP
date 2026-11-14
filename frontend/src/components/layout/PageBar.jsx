// Barra superior de cada sección: título a la izquierda y, al lado, lo que la pantalla necesite.
export default function PageBar({ title, children }) {
  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
      <h1 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h1>
      {children}
    </div>
  );
}
