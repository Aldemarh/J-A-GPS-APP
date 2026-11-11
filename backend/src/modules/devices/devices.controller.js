import * as service from './devices.service.js';

// El tenant SIEMPRE sale del token (req.user), nunca del body ni de la URL.

export async function list(req, res) {
  res.json({ devices: await service.list(req.user.tenantId) });
}

export async function get(req, res) {
  res.json({ device: await service.get(req.user.tenantId, req.params.id) });
}

export async function create(req, res) {
  const device = await service.create(req.user.tenantId, req.body);
  res.status(201).json({ device });
}

export async function update(req, res) {
  res.json({ device: await service.update(req.user.tenantId, req.params.id, req.body) });
}

export async function remove(req, res) {
  await service.remove(req.user.tenantId, req.params.id);
  res.status(204).end();
}
