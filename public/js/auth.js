import { api } from './api.js';

export async function getMe() {
  try {
    const data = await api.get('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function login(identifier, password) {
  const data = await api.post('/auth/login', { identifier, password });
  return data.user;
}

export async function register(username, email, password) {
  const data = await api.post('/auth/register', { username, email, password });
  return data.user;
}

export async function logout() {
  await api.post('/auth/logout');
}
