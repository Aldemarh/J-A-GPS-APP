import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <p className="text-slate-600">Esta página no existe.</p>
      <Link to="/" className="font-semibold text-brand-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
