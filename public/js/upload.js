import { api } from './api.js';
import { showToast } from './utils.js';

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function hasAllowedExtension(filename) {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function createProgressRow(listEl, filename) {
  const item = document.createElement('div');
  item.className = 'upload-progress-item';
  item.innerHTML = `
    <div class="upload-name"><span class="fname"></span><span class="pct">0%</span></div>
    <div class="upload-progress-bar-track"><div class="upload-progress-bar-fill"></div></div>
  `;
  item.querySelector('.fname').textContent = filename;
  listEl.appendChild(item);
  return {
    setProgress(fraction) {
      const pct = Math.round(fraction * 100);
      item.querySelector('.pct').textContent = `${pct}%`;
      item.querySelector('.upload-progress-bar-fill').style.width = `${pct}%`;
    },
    setError(message) {
      item.classList.add('error');
      item.querySelector('.pct').textContent = message;
    },
    remove() {
      setTimeout(() => item.remove(), 900);
    },
  };
}

async function uploadOneFile(file, listEl, onUploaded) {
  if (!hasAllowedExtension(file.name)) {
    showToast(`${file.name}: unsupported file type`, 'error');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showToast(`${file.name}: file is larger than 50 MB`, 'error');
    return;
  }

  const row = createProgressRow(listEl, file.name);
  const formData = new FormData();
  formData.append('files', file);

  try {
    const data = await api.upload('/tracks/upload', formData, (fraction) => row.setProgress(fraction));
    row.setProgress(1);
    row.remove();
    (data.tracks || []).forEach((track) => onUploaded(track));
  } catch (err) {
    row.setError(err.message || 'Error');
    showToast(`${file.name}: ${err.message || 'Upload failed'}`, 'error');
  }
}

export function setupUpload({ zoneEl, inputEl, progressListEl, onUploaded }) {
  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    await Promise.all(files.map((file) => uploadOneFile(file, progressListEl, onUploaded)));
  }

  zoneEl.addEventListener('click', () => inputEl.click());

  inputEl.addEventListener('change', () => {
    handleFiles(inputEl.files);
    inputEl.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    zoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zoneEl.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    zoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zoneEl.classList.remove('drag-over');
    });
  });

  zoneEl.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });
}
