import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import * as repo from './auth.repository.js';

const BCRYPT_ROUNDS = 12;

// Hash que se compara cuando el usuario no existe, para que el tiempo de
// respuesta no revele si un correo está registrado (anti user-enumeration).
const DUMMY_HASH = bcrypt.hashSync('contraseña-ficticia-para-tiempos', BCRYPT_ROUNDS);

function signToken(user) {
  return jwt.sign(
    { tenantId: user.tenant_id ?? user.tenantId, role: user.role },
    config.JWT_SECRET,
    {
      subject: user.id,
      issuer: 'jya-gps',
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN,
    },
  );
}

function toPublicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenant_id ?? user.tenantId,
    email: user.email,
    fullName: user.full_name ?? user.fullName,
    role: user.role,
  };
}

export async function register({ fullName, email, password }) {
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    throw new AppError(409, 'Ya existe una cuenta con ese correo.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await repo.createPersonalAccount({ fullName, email, passwordHash });

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  // Mensaje genérico: no se distingue entre correo inexistente y clave incorrecta.
  if (!user || !passwordOk || !user.is_active) {
    throw new AppError(401, 'Correo o contraseña incorrectos.');
  }

  return { token: signToken(user), user: toPublicUser(user) };
}

export async function getProfile(userId) {
  const user = await repo.findUserById(userId);
  if (!user || !user.is_active) {
    throw new AppError(404, 'Usuario no encontrado.');
  }
  return {
    ...toPublicUser(user),
    tenant: { name: user.tenant_name, type: user.tenant_type },
  };
}
