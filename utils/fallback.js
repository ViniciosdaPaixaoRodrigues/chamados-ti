// Fallback JSON loader utility
// Returns parsed JSON from a file inside the project's 'fallback' folder.
// If the file cannot be read or parsed, returns null.

const fs = require('fs');
const path = require('path');

function loadFallback(fileName) {
  try {
    const fullPath = path.resolve(__dirname, '..', 'fallback', fileName);
    const data = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Fallback load error for', fileName, e);
    return null;
  }
}

module.exports = { loadFallback };
