// Cliente HTTP único para hablar con la API.
// Centraliza: base URL, header Authorization y tratamiento de errores.

const TOKEN_KEY = 'jya_gps_token';

// Acceso seguro a localStorage (puede fallar en modo privado o con datos bloqueados).
export const tokenStorage = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* sin persistencia: la sesión durará solo mientras la pestaña esté abierta */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada que limpiar */
    }
  },
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const authToken = token ?? tokenStorage.get();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica que la API esté activa.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }

  if (!res.ok) {
    const fallback =
      res.status === 502 || res.status === 503 || res.status === 504
        ? 'El servidor no está disponible en este momento. Verifica que el backend esté corriendo.'
        : `Error ${res.status}`;
    throw new ApiError(data?.error || fallback, res.status, data?.details);
  }
  return data;
}

export const authApi = {
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
  me: () => apiRequest('/auth/me'),
};
