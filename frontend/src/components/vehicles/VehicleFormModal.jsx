import { useState } from 'react';
import FormField from '../FormField.jsx';
import Modal from '../Modal.jsx';
import { ApiError } from '../../api/client.js';
import { VEHICLE_TYPE_LABELS } from './vehicleTypes.js';

const EMPTY = { name: '', plate: '', type: 'car', brand: '', model: '', color: '', year: '' };

function toForm(vehicle) {
  if (!vehicle) return EMPTY;
  return {
    name: vehicle.name ?? '',
    plate: vehicle.plate ?? '',
    type: vehicle.type ?? 'car',
    brand: vehicle.brand ?? '',
    model: vehicle.model ?? '',
    color: vehicle.color ?? '',
    year: vehicle.year ?? '',
  };
}

/**
 * Modal para crear (vehicle = null) o editar un vehículo.
 * onSubmit(payload) debe devolver una promesa; si falla con ApiError, se muestran los errores.
 */
export default function VehicleFormModal({ vehicle, onSubmit, onClose }) {
  const isEdit = Boolean(vehicle);
  const [form, setForm] = useState(() => toForm(vehicle));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await onSubmit(form);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field || '_', d.message])));
        if (err.details.some((d) => !d.field)) setError(err.details.find((d) => !d.field).message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      }
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Editar vehículo' : 'Agregar vehículo'} onClose={onClose} closeDisabled={submitting}>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {error && (
          <div role="alert" className="alert-error">
            {error}
          </div>
        )}

        <FormField
          id="name"
          name="name"
          label="Nombre del vehículo"
          placeholder="Ej: Carro de la casa"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          autoFocus
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="plate"
            name="plate"
            label="Placa"
            placeholder="ABC123"
            value={form.plate}
            onChange={handleChange}
            error={fieldErrors.plate}
            autoCapitalize="characters"
            required
          />
          <div>
            <label htmlFor="type" className="field-label">
              Tipo
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="input"
            >
              {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldErrors.type && <p className="mt-1 text-xs text-red">{fieldErrors.type}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="brand" name="brand" label="Marca (opcional)" value={form.brand} onChange={handleChange} error={fieldErrors.brand} />
          <FormField id="model" name="model" label="Modelo (opcional)" value={form.model} onChange={handleChange} error={fieldErrors.model} />
          <FormField id="color" name="color" label="Color (opcional)" value={form.color} onChange={handleChange} error={fieldErrors.color} />
          <FormField
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            label="Año (opcional)"
            value={form.year}
            onChange={handleChange}
            error={fieldErrors.year}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar vehículo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
