export function setupSidebar({ onNavigate, onNewPlaylist }) {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const overviewBtn = document.getElementById('nav-overview');
  const favoritesBtn = document.getElementById('nav-favorites');
  const playlistsToggleBtn = document.getElementById('nav-playlists-toggle');
  const playlistsGroup = document.getElementById('playlists-group');
  const newPlaylistBtn = document.getElementById('btn-new-playlist');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('expanded');
  });

  overviewBtn.addEventListener('click', () => onNavigate('overview'));
  favoritesBtn.addEventListener('click', () => onNavigate('favorites'));
  playlistsToggleBtn.addEventListener('click', () => playlistsGroup.classList.toggle('open'));
  newPlaylistBtn.addEventListener('click', () => onNewPlaylist());
}

export function setActiveNav(view) {
  document.getElementById('nav-overview').classList.toggle('active', view === 'overview');
  document.getElementById('nav-favorites').classList.toggle('active', view === 'favorites');
}
