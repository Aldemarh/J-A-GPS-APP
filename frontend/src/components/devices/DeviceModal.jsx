import { useState } from 'react';
import FormField from '../FormField.jsx';
import Modal from '../Modal.jsx';
import { ApiError } from '../../api/client.js';
import { PROTOCOL_LABELS, formatLastSeen } from './deviceFormat.js';

/**
 * GPS de un vehículo: si no tiene dispositivo, permite crearlo; si lo tiene, muestra su identificador.
 * onCreate(payload) y onRemove(device) devuelven promesas.
 */
export default function DeviceModal({ vehicle, device, lastPositionAt, canEdit, onCreate, onRemove, onClose }) {
  const [name, setName] = useState('Mi celular');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');

  async function run(action) {
    setError('');
    setNameError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        const forName = err.details.find((d) => d.field === 'name');
        const other = err.details.find((d) => d.field !== 'name');
        if (forName) setNameError(forName.message);
        if (other) setError(other.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(e) {
    e.preventDefault();
    run(() => onCreate({ name, vehicleId: vehicle.id }));
  }

  function handleRemove() {
    if (!window.confirm(`¿Eliminar el dispositivo "${device.name}"? El celular dejará de reportar a este vehículo.`)) return;
    run(() => onRemove(device));
  }

  async function copyIdentifier() {
    try {
      await navigator.clipboard.writeText(device.identifier);
      setCopyNotice('Copiado.');
    } catch {
      setCopyNotice('No se pudo copiar: selecciónalo y cópialo manualmente.');
    }
  }

  const errorBox = error && (
    <div role="alert" className="mt-4 alert-error">
      {error}
    </div>
  );

  if (!device) {
    return (
      <Modal title={`Conectar GPS a ${vehicle.name}`} onClose={onClose} closeDisabled={busy}>
        <p className="mt-2 text-sm text-mute">
          El rastreador será tu celular, con la app gratuita <strong className="text-fg">Traccar Client</strong> (Android y iOS). Al crear el
          dispositivo recibirás un identificador para configurarla.
        </p>
        {errorBox}
        <form onSubmit={handleCreate} noValidate className="mt-4 space-y-4">
          <FormField
            id="device-name"
            name="name"
            label="Nombre del dispositivo"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError('');
            }}
            error={nameError}
            autoFocus
            required
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn btn-ghost"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? 'Creando...' : 'Crear dispositivo'}
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal title={`GPS de ${vehicle.name}`} onClose={onClose} closeDisabled={busy}>
      {errorBox}
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-mute">Nombre</dt>
        <dd className="font-medium text-fg">{device.name}</dd>
        <dt className="text-mute">Tipo</dt>
        <dd className="text-fg">{PROTOCOL_LABELS[device.protocol] ?? device.protocol}</dd>
        <dt className="text-mute">Estado</dt>
        <dd className="text-fg">{formatLastSeen(lastPositionAt ?? device.lastSeenAt)}</dd>
      </dl>

      <div className="mt-5 rounded-xl border border-line bg-ink-3 p-4">
        <p className="text-sm font-medium text-mute">Identificador del dispositivo</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="select-all rounded-md border border-line-2 bg-panel px-3 py-2 font-mono text-lg tracking-wider text-fg">
            {device.identifier}
          </code>
          <button
            type="button"
            onClick={copyIdentifier}
            className="btn btn-ghost px-3 py-1.5"
          >
            Copiar
          </button>
        </div>
        {copyNotice && (
          <p role="status" className="mt-2 text-xs text-mute">
            {copyNotice}
          </p>
        )}
        <p className="mt-3 text-xs text-dim">
          Escríbelo en el campo «Identificador del dispositivo» de Traccar Client. Funciona como la contraseña del
          dispositivo: no lo compartas.
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {canEdit ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="btn btn-danger"
          >
            {busy ? 'Eliminando...' : 'Eliminar dispositivo'}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="btn btn-ghost"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
