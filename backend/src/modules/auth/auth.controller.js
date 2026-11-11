import * as authService from './auth.service.js';

// Controladores: solo leen la petición, llaman al servicio y responden.

export async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

export async function me(req, res) {
  const profile = await authService.getProfile(req.user.id);
  res.json({ user: profile });
}
