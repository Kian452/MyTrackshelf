import { api } from './api.js';

export function fetchPlaylists() {
  return api.get('/playlists').then((data) => data.playlists);
}

export function fetchPlaylistDetail(id) {
  return api.get(`/playlists/${id}`);
}

export function createPlaylist(name) {
  return api.post('/playlists', { name }).then((data) => data.playlist);
}

export function renamePlaylist(id, name) {
  return api.patch(`/playlists/${id}`, { name }).then((data) => data.playlist);
}

export function deletePlaylist(id) {
  return api.del(`/playlists/${id}`);
}

export function addTrackToPlaylist(playlistId, trackId) {
  return api.post(`/playlists/${playlistId}/tracks`, { trackId });
}

export function removeTrackFromPlaylist(playlistId, trackId) {
  return api.del(`/playlists/${playlistId}/tracks/${trackId}`);
}

export function reorderPlaylist(playlistId, trackIds) {
  return api.patch(`/playlists/${playlistId}/reorder`, { trackIds });
}

export function renderPlaylistSidebar(container, playlists, { activeId, onSelect }) {
  container.innerHTML = '';
  playlists.forEach((pl) => {
    const btn = document.createElement('button');
    btn.className = `playlist-nav-item${activeId === pl.id ? ' active' : ''}`;
    btn.textContent = `${pl.name} (${pl.track_count})`;
    btn.addEventListener('click', () => onSelect(pl.id));
    container.appendChild(btn);
  });
}
