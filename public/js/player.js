function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Player {
  constructor({ audioEl, onTrackChange, onTimeUpdate, onPlayStateChange, onQueueEnd }) {
    this.audio = audioEl;
    this.queue = [];
    this.order = [];
    this.pos = -1;
    this.shuffle = false;

    this.onTrackChange = onTrackChange || (() => {});
    this.onTimeUpdate = onTimeUpdate || (() => {});
    this.onPlayStateChange = onPlayStateChange || (() => {});
    this.onQueueEnd = onQueueEnd || (() => {});

    this.audio.addEventListener('timeupdate', () =>
      this.onTimeUpdate(this.audio.currentTime, this.audio.duration)
    );
    this.audio.addEventListener('loadedmetadata', () =>
      this.onTimeUpdate(this.audio.currentTime, this.audio.duration)
    );
    this.audio.addEventListener('play', () => this.onPlayStateChange(true));
    this.audio.addEventListener('pause', () => this.onPlayStateChange(false));
    this.audio.addEventListener('ended', () => this._handleEnded());
  }

  get currentTrack() {
    if (this.pos < 0 || this.pos >= this.order.length) return null;
    return this.queue[this.order[this.pos]];
  }

  get isPlaying() {
    return !this.audio.paused && !this.audio.ended;
  }

  loadQueue(tracks, startIndex = 0) {
    this.queue = tracks;
    this.order = this.shuffle ? this._shuffledOrderStartingAt(startIndex) : tracks.map((_, i) => i);
    this.pos = this.shuffle ? 0 : startIndex;
    this._playCurrent();
  }

  _shuffledOrderStartingAt(startIndex) {
    const rest = this.queue.map((_, i) => i).filter((i) => i !== startIndex);
    return [startIndex, ...shuffleArray(rest)];
  }

  toggleShuffle(force) {
    this.shuffle = force !== undefined ? force : !this.shuffle;
    if (this.queue.length === 0) return this.shuffle;

    const currentIndex = this.order[this.pos];
    if (this.shuffle) {
      this.order = this._shuffledOrderStartingAt(currentIndex);
      this.pos = 0;
    } else {
      this.order = this.queue.map((_, i) => i);
      this.pos = this.order.indexOf(currentIndex);
    }
    return this.shuffle;
  }

  _playCurrent() {
    const track = this.currentTrack;
    if (!track) return;
    this.audio.src = `/api/tracks/${track.id}/stream`;
    this.audio.play().catch(() => {});
    this.onTrackChange(track);
  }

  toggle() {
    if (!this.currentTrack) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  next() {
    if (this.order.length === 0) return;
    if (this.pos < this.order.length - 1) {
      this.pos += 1;
      this._playCurrent();
    } else {
      this.audio.pause();
      this.onQueueEnd();
    }
  }

  prev() {
    if (this.order.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.pos > 0) {
      this.pos -= 1;
      this._playCurrent();
    } else {
      this.audio.currentTime = 0;
    }
  }

  seekBy(deltaSeconds) {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.min(Math.max(0, this.audio.currentTime + deltaSeconds), this.audio.duration);
  }

  seekToFraction(fraction) {
    if (!this.audio.duration) return;
    this.audio.currentTime = fraction * this.audio.duration;
  }

  setVolume(v) {
    this.audio.volume = v;
    if (v > 0) this.audio.muted = false;
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    return this.audio.muted;
  }

  _handleEnded() {
    if (this.pos < this.order.length - 1) {
      this.next();
    } else {
      this.onQueueEnd();
    }
  }
}
