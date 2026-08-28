import { api } from './api.js';

export function fetchFavorites() {
  return api.get('/favorites').then((data) => data.tracks);
}

export function addFavorite(trackId) {
  return api.post(`/favorites/${trackId}`);
}

export function removeFavorite(trackId) {
  return api.del(`/favorites/${trackId}`);
}
