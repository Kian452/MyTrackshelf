import { api } from './api.js';
import { getMe, logout } from './auth.js';
import { Player } from './player.js';
import { renderTrackList } from './trackList.js';
import { setupUpload } from './upload.js';
import {
  fetchPlaylists,
  fetchPlaylistDetail,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylist,
  renderPlaylistSidebar,
} from './playlists.js';
import { fetchFavorites, addFavorite, removeFavorite } from './favorites.js';
import { setupSidebar, setActiveNav } from './sidebar.js';
import { showToast, ICONS, escapeForInitial } from './utils.js';

const DEFAULT_COVER_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';

const state = {
  user: null,
  tracks: [],
  playlists: [],
  favorites: [],
  favoriteIds: new Set(),
  currentView: 'overview',
  currentPlaylistId: null,
  currentPlaylist: null,
  currentPlaylistTracks: [],
};

const audioEl = new Audio();
let isSeeking = false;

const player = new Player({
  audioEl,
  onTrackChange: updatePlayerUI,
  onTimeUpdate: updateProgressUI,
  onPlayStateChange: updatePlayPauseUI,
  onQueueEnd: () => {},
});

// ---------- View navigation ----------

function showView(viewName) {
  document.getElementById('view-overview').classList.toggle('hidden', viewName !== 'overview');
  document.getElementById('view-playlist').classList.toggle('hidden', viewName !== 'playlist');
  document.getElementById('view-favorites').classList.toggle('hidden', viewName !== 'favorites');
}

function setViewTitle(text) {
  document.getElementById('view-title').textContent = text;
}

function renderSidebarPlaylists() {
  renderPlaylistSidebar(document.getElementById('playlist-list'), state.playlists, {
    activeId: state.currentView === 'playlist' ? state.currentPlaylistId : null,
    onSelect: (id) => goToPlaylist(id),
  });
}

function goToOverview() {
  state.currentView = 'overview';
  state.currentPlaylistId = null;
  showView('overview');
  setViewTitle('Overview');
  setActiveNav('overview');
  renderSidebarPlaylists();
  renderOverview();
}

async function goToFavorites() {
  state.currentView = 'favorites';
  state.currentPlaylistId = null;
  showView('favorites');
  setViewTitle('Favorite Songs');
  setActiveNav('favorites');
  renderSidebarPlaylists();
  try {
    state.favorites = await fetchFavorites();
    state.favoriteIds = new Set(state.favorites.map((t) => Number(t.id)));
  } catch (err) {
    showToast(err.message, 'error');
  }
  renderFavoritesView();
}

async function goToPlaylist(playlistId) {
  try {
    const data = await fetchPlaylistDetail(playlistId);
    state.currentView = 'playlist';
    state.currentPlaylistId = playlistId;
    state.currentPlaylist = data.playlist;
    state.currentPlaylistTracks = data.tracks;
    showView('playlist');
    setActiveNav('playlist');
    setViewTitle(data.playlist.name);
    document.getElementById('playlist-view-name').textContent = data.playlist.name;
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  renderSidebarPlaylists();
  renderPlaylistView();
  syncShuffleUI(player.shuffle);
}

// ---------- Rendering (from cached state) ----------

function renderOverview() {
  renderTrackList(document.getElementById('track-list-overview'), state.tracks, {
    context: 'overview',
    favoriteIds: state.favoriteIds,
    currentTrackId: player.currentTrack ? player.currentTrack.id : null,
    getPlaylists: () => state.playlists,
    onPlay: (track, index, list) => playFromList(list, index),
    onToggleFavorite: handleToggleFavorite,
    onDelete: handleDeleteTrack,
    onAddToPlaylist: handleAddToPlaylist,
  });
}

function renderFavoritesView() {
  renderTrackList(document.getElementById('track-list-favorites'), state.favorites, {
    context: 'favorites',
    favoriteIds: state.favoriteIds,
    currentTrackId: player.currentTrack ? player.currentTrack.id : null,
    getPlaylists: () => state.playlists,
    onPlay: (track, index, list) => playFromList(list, index),
    onToggleFavorite: handleToggleFavorite,
    onAddToPlaylist: handleAddToPlaylist,
  });
}

function renderPlaylistView() {
  renderTrackList(document.getElementById('track-list-playlist'), state.currentPlaylistTracks, {
    context: 'playlist',
    favoriteIds: state.favoriteIds,
    currentTrackId: player.currentTrack ? player.currentTrack.id : null,
    getPlaylists: () => state.playlists,
    onPlay: (track, index, list) => playFromList(list, index),
    onToggleFavorite: handleToggleFavorite,
    onAddToPlaylist: handleAddToPlaylist,
    onRemoveFromPlaylist: handleRemoveFromPlaylist,
    onReorder: handleReorder,
  });
}

function refreshVisibleView() {
  if (state.currentView === 'overview') renderOverview();
  else if (state.currentView === 'favorites') renderFavoritesView();
  else if (state.currentView === 'playlist') renderPlaylistView();
}

// ---------- Action handlers ----------

async function handleToggleFavorite(track) {
  const id = Number(track.id);
  const isFav = state.favoriteIds.has(id);
  try {
    if (isFav) {
      await removeFavorite(id);
      state.favoriteIds.delete(id);
      state.favorites = state.favorites.filter((t) => Number(t.id) !== id);
    } else {
      await addFavorite(id);
      state.favoriteIds.add(id);
      state.favorites = [track, ...state.favorites];
    }
    refreshVisibleView();
    updatePlayerFavoriteButton();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteTrack(track) {
  if (!confirm(`Really delete "${track.title}"?`)) return;
  try {
    await api.del(`/tracks/${track.id}`);
    state.tracks = state.tracks.filter((t) => t.id !== track.id);
    state.favoriteIds.delete(Number(track.id));
    state.favorites = state.favorites.filter((t) => t.id !== track.id);

    if (player.currentTrack && player.currentTrack.id === track.id) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      hidePlayerBar();
    }

    renderOverview();
    state.playlists = await fetchPlaylists();
    renderSidebarPlaylists();
    showToast('Track deleted');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleAddToPlaylist(track, playlistId) {
  try {
    await addTrackToPlaylist(playlistId, track.id);
    state.playlists = await fetchPlaylists();
    renderSidebarPlaylists();
    if (state.currentView === 'playlist' && state.currentPlaylistId === playlistId) {
      const data = await fetchPlaylistDetail(playlistId);
      state.currentPlaylistTracks = data.tracks;
      renderPlaylistView();
    }
    showToast('Added to playlist');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRemoveFromPlaylist(track) {
  try {
    await removeTrackFromPlaylist(state.currentPlaylistId, track.id);
    state.currentPlaylistTracks = state.currentPlaylistTracks.filter((t) => t.id !== track.id);
    renderPlaylistView();
    state.playlists = await fetchPlaylists();
    renderSidebarPlaylists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleReorder(newOrderTrackIds) {
  const byId = new Map(state.currentPlaylistTracks.map((t) => [Number(t.id), t]));
  state.currentPlaylistTracks = newOrderTrackIds.map((id) => byId.get(Number(id))).filter(Boolean);
  try {
    await reorderPlaylist(state.currentPlaylistId, newOrderTrackIds);
  } catch (err) {
    showToast(err.message, 'error');
    const data = await fetchPlaylistDetail(state.currentPlaylistId);
    state.currentPlaylistTracks = data.tracks;
    renderPlaylistView();
  }
}

function playFromList(list, index) {
  player.loadQueue(list, index);
  showPlayerBar();
}

// ---------- Player UI ----------

function showPlayerBar() {
  document.getElementById('player-bar').classList.remove('hidden');
}

function hidePlayerBar() {
  document.getElementById('player-bar').classList.add('hidden');
  document.getElementById('player-title').textContent = '–';
  document.getElementById('player-artist').textContent = '–';
  document.getElementById('player-cover').innerHTML = DEFAULT_COVER_SVG;
}

function updatePlayerUI(track) {
  document.getElementById('player-title').textContent = track.title;
  document.getElementById('player-artist').textContent = track.artist || 'Unknown artist';
  const cover = document.getElementById('player-cover');
  cover.innerHTML = track.cover_path
    ? `<img src="/api/tracks/${track.id}/cover" alt="">`
    : DEFAULT_COVER_SVG;
  updatePlayerFavoriteButton();
  highlightPlayingRow(track.id);
  showPlayerBar();
}

function updatePlayerFavoriteButton() {
  const track = player.currentTrack;
  const btn = document.getElementById('player-favorite-btn');
  if (!track) return;
  const isFav = state.favoriteIds.has(Number(track.id));
  btn.innerHTML = isFav ? ICONS.heartFilled : ICONS.heart;
  btn.classList.toggle('active', isFav);
}

function highlightPlayingRow(trackId) {
  document.querySelectorAll('.track-row').forEach((row) => {
    row.classList.toggle('playing', Number(row.dataset.trackId) === Number(trackId));
  });
}

function updateProgressUI(current, duration) {
  document.getElementById('player-current-time').textContent = formatTime(current);
  document.getElementById('player-duration').textContent = formatTime(duration || 0);
  if (!isSeeking && duration) {
    document.getElementById('progress-slider').value = String(Math.round((current / duration) * 1000));
  }
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updatePlayPauseUI(isPlaying) {
  document.getElementById('icon-play').classList.toggle('hidden', isPlaying);
  document.getElementById('icon-pause').classList.toggle('hidden', !isPlaying);
}

function syncShuffleUI(on) {
  document.getElementById('btn-shuffle').classList.toggle('active', on);
  document.getElementById('btn-playlist-shuffle').classList.toggle('active', on);
}

function syncMuteIcon(forced) {
  const muted = forced !== undefined ? forced : audioEl.muted;
  document.getElementById('icon-vol').classList.toggle('hidden', muted);
  document.getElementById('icon-mute').classList.toggle('hidden', !muted);
}

function wirePlayerControls() {
  document.getElementById('btn-play').addEventListener('click', () => player.toggle());
  document.getElementById('btn-prev').addEventListener('click', () => player.prev());
  document.getElementById('btn-next').addEventListener('click', () => player.next());
  document.getElementById('btn-seek-back').addEventListener('click', () => player.seekBy(-10));
  document.getElementById('btn-seek-fwd').addEventListener('click', () => player.seekBy(10));

  document.getElementById('btn-shuffle').addEventListener('click', () => syncShuffleUI(player.toggleShuffle()));
  document
    .getElementById('btn-playlist-shuffle')
    .addEventListener('click', () => syncShuffleUI(player.toggleShuffle()));

  document.getElementById('player-favorite-btn').addEventListener('click', () => {
    if (player.currentTrack) handleToggleFavorite(player.currentTrack);
  });

  const progressSlider = document.getElementById('progress-slider');
  progressSlider.addEventListener('input', () => {
    isSeeking = true;
    const fraction = Number(progressSlider.value) / 1000;
    document.getElementById('player-current-time').textContent = formatTime(fraction * (audioEl.duration || 0));
  });
  progressSlider.addEventListener('change', () => {
    player.seekToFraction(Number(progressSlider.value) / 1000);
    isSeeking = false;
  });

  const volumeSlider = document.getElementById('volume-slider');
  volumeSlider.addEventListener('input', () => {
    player.setVolume(Number(volumeSlider.value) / 100);
    syncMuteIcon(false);
  });
  document.getElementById('btn-mute').addEventListener('click', () => syncMuteIcon(player.toggleMute()));

  audioEl.volume = Number(volumeSlider.value) / 100;
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      player.toggle();
    } else if (e.code === 'ArrowRight') {
      player.next();
    } else if (e.code === 'ArrowLeft') {
      player.prev();
    }
  });
}

// ---------- Upload ----------

function wireUpload() {
  setupUpload({
    zoneEl: document.getElementById('upload-zone'),
    inputEl: document.getElementById('file-input'),
    progressListEl: document.getElementById('upload-progress-list'),
    onUploaded: (track) => {
      state.tracks = [track, ...state.tracks];
      if (state.currentView === 'overview') renderOverview();
    },
  });
}

// ---------- Account menu & settings ----------

function updateAccountAvatar() {
  document.getElementById('account-button').textContent = escapeForInitial(state.user.username);
}

function wireAccountMenu() {
  const dropdown = document.getElementById('account-dropdown');
  document.getElementById('account-button').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));

  document.getElementById('btn-open-settings').addEventListener('click', () => {
    dropdown.classList.add('hidden');
    openSettingsModal();
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    window.location.href = 'login.html';
  });
}

function openSettingsModal() {
  document.getElementById('settings-username').value = state.user.username;
  document.getElementById('settings-email').value = state.user.email;
  document.getElementById('settings-error').classList.add('hidden');
  document.getElementById('settings-success').classList.add('hidden');
  document.getElementById('password-error').classList.add('hidden');
  document.getElementById('password-success').classList.add('hidden');
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function wireSettingsModal() {
  document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);

  document.getElementById('account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('settings-username').value.trim();
    const email = document.getElementById('settings-email').value.trim();
    const errorBox = document.getElementById('settings-error');
    const successBox = document.getElementById('settings-success');
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');
    try {
      const data = await api.patch('/account', { username, email });
      state.user = data.user;
      updateAccountAvatar();
      successBox.textContent = 'Saved';
      successBox.classList.remove('hidden');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const errorBox = document.getElementById('password-error');
    const successBox = document.getElementById('password-success');
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');
    try {
      await api.patch('/account/password', { currentPassword, newPassword });
      successBox.textContent = 'Password changed';
      successBox.classList.remove('hidden');
      e.target.reset();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });

  document.getElementById('btn-delete-account').addEventListener('click', async () => {
    if (!confirm('Your account and all songs, playlists, and favorites will be permanently deleted. Continue?')) {
      return;
    }
    if (!confirm('Final confirmation: really delete EVERYTHING?')) return;
    try {
      await api.del('/account');
      window.location.href = 'login.html';
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------- New playlist modal ----------

function wireNewPlaylistModal() {
  const modal = document.getElementById('new-playlist-modal');
  const input = document.getElementById('new-playlist-name');
  const errorBox = document.getElementById('new-playlist-error');

  function open() {
    input.value = '';
    errorBox.classList.add('hidden');
    modal.classList.remove('hidden');
    input.focus();
  }
  function close() {
    modal.classList.add('hidden');
  }

  document.getElementById('btn-cancel-new-playlist').addEventListener('click', close);

  document.getElementById('new-playlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    try {
      const playlist = await createPlaylist(name);
      state.playlists = await fetchPlaylists();
      renderSidebarPlaylists();
      close();
      goToPlaylist(playlist.id);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });

  return { open };
}

function wirePlaylistViewActions() {
  document.getElementById('btn-rename-playlist').addEventListener('click', async () => {
    const current = state.currentPlaylist;
    const name = window.prompt('New name for the playlist', current.name);
    if (!name || !name.trim() || name.trim() === current.name) return;
    try {
      await renamePlaylist(current.id, name.trim());
      state.currentPlaylist.name = name.trim();
      document.getElementById('playlist-view-name').textContent = name.trim();
      setViewTitle(name.trim());
      state.playlists = await fetchPlaylists();
      renderSidebarPlaylists();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-delete-playlist').addEventListener('click', async () => {
    const current = state.currentPlaylist;
    if (!confirm(`Really delete the playlist "${current.name}"?`)) return;
    try {
      await deletePlaylist(current.id);
      state.playlists = await fetchPlaylists();
      renderSidebarPlaylists();
      goToOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------- Init ----------

async function init() {
  const user = await getMe();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  state.user = user;
  document.getElementById('app-shell').classList.remove('hidden');
  updateAccountAvatar();

  try {
    const [tracksData, playlists, favorites] = await Promise.all([
      api.get('/tracks'),
      fetchPlaylists(),
      fetchFavorites(),
    ]);
    state.tracks = tracksData.tracks;
    state.playlists = playlists;
    state.favorites = favorites;
    state.favoriteIds = new Set(favorites.map((t) => Number(t.id)));
  } catch (err) {
    showToast('Failed to load data', 'error');
  }

  const newPlaylistModal = wireNewPlaylistModal();
  setupSidebar({
    onNavigate: (view) => (view === 'overview' ? goToOverview() : goToFavorites()),
    onNewPlaylist: () => newPlaylistModal.open(),
  });

  renderSidebarPlaylists();
  goToOverview();

  wireUpload();
  wirePlayerControls();
  wireKeyboardShortcuts();
  wireAccountMenu();
  wireSettingsModal();
  wirePlaylistViewActions();
}

init();
