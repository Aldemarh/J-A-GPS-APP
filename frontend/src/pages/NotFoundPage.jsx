import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-5xl font-medium text-blue">404</p>
      <p className="text-mute">Esta página no existe.</p>
      <Link to="/" className="font-medium text-blue hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
