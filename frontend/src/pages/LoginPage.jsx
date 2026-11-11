import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../api/client.js';

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Accede al monitoreo de tus vehículos"
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <FormField
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Contraseña"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </AuthLayout>
  );
}
