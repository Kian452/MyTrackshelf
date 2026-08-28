import { formatDuration, ICONS, closeAllPopovers } from './utils.js';

function openAddToPlaylistPopover(anchorBtn, track, { getPlaylists, onAddToPlaylist }) {
  closeAllPopovers();
  const playlists = getPlaylists();

  const pop = document.createElement('div');
  pop.className = 'popover';

  if (playlists.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'popover-empty';
    empty.textContent = 'Keine Playlists vorhanden';
    pop.appendChild(empty);
  } else {
    playlists.forEach((pl) => {
      const btn = document.createElement('button');
      btn.className = 'popover-item';
      btn.textContent = pl.name;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        pop.remove();
        onAddToPlaylist(track, pl.id);
      });
      pop.appendChild(btn);
    });
  }

  anchorBtn.parentElement.appendChild(pop);

  setTimeout(() => {
    document.addEventListener(
      'click',
      function handler(e) {
        if (!pop.contains(e.target)) {
          pop.remove();
          document.removeEventListener('click', handler);
        }
      },
      { once: false }
    );
  }, 0);
}

export function renderTrackList(container, tracks, options) {
  const {
    context = 'overview',
    favoriteIds = new Set(),
    currentTrackId = null,
    getPlaylists = () => [],
    onPlay = () => {},
    onToggleFavorite = () => {},
    onDelete = () => {},
    onAddToPlaylist = () => {},
    onRemoveFromPlaylist = () => {},
    onReorder = () => {},
  } = options;

  container.innerHTML = '';

  if (tracks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'track-list-empty';
    empty.textContent =
      context === 'favorites'
        ? 'Noch keine Favoriten. Markiere Songs mit dem Herz-Symbol.'
        : context === 'playlist'
        ? 'Diese Playlist ist noch leer.'
        : 'Noch keine Songs hochgeladen.';
    container.appendChild(empty);
    return;
  }

  tracks.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.dataset.trackId = String(track.id);
    if (currentTrackId && Number(currentTrackId) === Number(track.id)) {
      row.classList.add('playing');
    }

    if (context === 'playlist') {
      row.draggable = true;
      const handle = document.createElement('span');
      handle.className = 'track-drag-handle';
      handle.innerHTML = ICONS.drag;
      row.appendChild(handle);
    }

    const playBtn = document.createElement('button');
    playBtn.className = 'track-play-btn';
    playBtn.innerHTML = ICONS.play;
    playBtn.setAttribute('aria-label', 'Abspielen');
    playBtn.addEventListener('click', () => onPlay(track, index, tracks));
    row.appendChild(playBtn);

    const info = document.createElement('div');
    info.className = 'track-info';
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;
    const artist = document.createElement('div');
    artist.className = 'track-artist';
    artist.textContent = track.artist || 'Unbekannter Künstler';
    info.appendChild(title);
    info.appendChild(artist);
    row.appendChild(info);

    const duration = document.createElement('div');
    duration.className = 'track-duration';
    duration.textContent = formatDuration(track.duration_seconds);
    row.appendChild(duration);

    const actions = document.createElement('div');
    actions.className = 'track-actions';

    const favBtn = document.createElement('button');
    const isFav = favoriteIds.has(Number(track.id));
    favBtn.className = `icon-btn${isFav ? ' active' : ''}`;
    favBtn.innerHTML = isFav ? ICONS.heartFilled : ICONS.heart;
    favBtn.setAttribute('aria-label', 'Favorit umschalten');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onToggleFavorite(track);
    });
    actions.appendChild(favBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'icon-btn';
    addBtn.innerHTML = ICONS.plus;
    addBtn.setAttribute('aria-label', 'Zu Playlist hinzufügen');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToPlaylistPopover(addBtn, track, { getPlaylists, onAddToPlaylist });
    });
    actions.appendChild(addBtn);

    if (context === 'playlist') {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn danger';
      removeBtn.innerHTML = ICONS.remove;
      removeBtn.setAttribute('aria-label', 'Aus Playlist entfernen');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemoveFromPlaylist(track);
      });
      actions.appendChild(removeBtn);
    } else {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn danger';
      deleteBtn.innerHTML = ICONS.trash;
      deleteBtn.setAttribute('aria-label', context === 'favorites' ? 'Favorit entfernen' : 'Track löschen');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (context === 'favorites') {
          onToggleFavorite(track);
        } else {
          onDelete(track);
        }
      });
      actions.appendChild(deleteBtn);
    }

    row.appendChild(actions);
    container.appendChild(row);
  });

  if (context === 'playlist') {
    wireDragReorder(container, onReorder);
  }
}

function wireDragReorder(container, onReorder) {
  let draggedId = null;

  container.querySelectorAll('.track-row').forEach((row) => {
    row.addEventListener('dragstart', () => {
      draggedId = row.dataset.trackId;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      const newOrder = Array.from(container.querySelectorAll('.track-row')).map((r) => Number(r.dataset.trackId));
      onReorder(newOrder);
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = container.querySelector('.dragging');
      if (!dragging || dragging === row) return;
      const rect = row.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      container.insertBefore(dragging, before ? row : row.nextSibling);
    });
  });
}
