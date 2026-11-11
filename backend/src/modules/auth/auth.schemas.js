import { z } from 'zod';

const email = z
  .string({ error: (iss) => (iss.input === undefined ? 'El correo es obligatorio.' : 'El correo no es válido.') })
  .trim()
  .toLowerCase()
  .email('El correo no es válido.')
  .max(254);

const password = z
  .string({ error: (iss) => (iss.input === undefined ? 'La contraseña es obligatoria.' : 'La contraseña no es válida.') })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar 72 caracteres.'); // límite de bcrypt

export const registerSchema = z.object({
  fullName: z
    .string({ error: (iss) => (iss.input === undefined ? 'El nombre es obligatorio.' : 'El nombre no es válido.') })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(150),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: (iss) => (iss.input === undefined ? 'La contraseña es obligatoria.' : 'La contraseña no es válida.') }).min(1).max(72),
});
