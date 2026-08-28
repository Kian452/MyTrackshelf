const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR } = require('../config');

const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

// Browsers sometimes report inconsistent MIME types for m4a/flac, so in
// addition to the "audio/" prefix we allow a whitelist of specific values
// plus a generic fallback. The file extension remains the primary,
// reliable check.
const ALLOWED_MIME_EXACT = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
  'audio/x-flac',
  'application/octet-stream',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = file.mimetype.startsWith('audio/') || ALLOWED_MIME_EXACT.has(file.mimetype);
  if (!ALLOWED_EXTENSIONS.has(ext) || !mimeOk) {
    return cb(new Error('UNSUPPORTED_FILE_TYPE'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 20 },
});

module.exports = { upload, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES };
