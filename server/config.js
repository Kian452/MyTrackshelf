const path = require('path');
const fs = require('fs');

// DATA_DIR is configurable so ./data is used locally, while on Railway it
// can point at the mount path of the persistent volume instead.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

module.exports = { DATA_DIR, UPLOADS_DIR, COVERS_DIR };
