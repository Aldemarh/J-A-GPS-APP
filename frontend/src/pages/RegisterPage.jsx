import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../api/client.js';

const emptyForm = { fullName: '', email: '', password: '' };

export default function RegisterPage() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        // Los errores de validación del servidor llegan por campo.
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Empieza a monitorear tus vehículos"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-blue hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="alert-error">
            {error}
          </div>
        )}
        <FormField
          id="fullName"
          name="fullName"
          label="Nombre completo"
          autoComplete="name"
          value={form.fullName}
          onChange={handleChange}
          error={fieldErrors.fullName}
          required
        />
        <FormField
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          required
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary w-full py-2.5"
        >
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
