// One-shot helper: load data.js / dictionary.js, then re-emit them so that
// the heavy literal becomes JSON.parse(<string>). JSON.parse is significantly
// faster than constructing an equivalent object literal in JS, especially on
// low-end mobile CPUs.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Provide a stub for the global window so legacy snippets don't crash on require.
global.window = {};

// Use Function to eval the file in a controlled scope, capturing SENTENCES.
function loadGlobal(filePath, globalName) {
  const src = fs.readFileSync(filePath, 'utf8');
  const fn = new Function(`${src}; return ${globalName};`);
  return fn();
}

const SENTENCES = loadGlobal(path.join(ROOT, 'js/data.js'), 'SENTENCES');
const DICTIONARY = loadGlobal(path.join(ROOT, 'js/dictionary.js'), 'DICTIONARY');

console.log(`SENTENCES: ${SENTENCES.length} entries`);
console.log(`DICTIONARY: ${Object.keys(DICTIONARY).length} entries`);

// Use compact JSON (no whitespace) for smallest size + fastest parse.
const sentencesJson = JSON.stringify(SENTENCES);
const dictionaryJson = JSON.stringify(DICTIONARY);

console.log(
  `JSON sizes — SENTENCES: ${sentencesJson.length} chars, DICTIONARY: ${dictionaryJson.length} chars`
);

// Escape the JSON string for embedding inside a JS string literal.
// We use a single-quoted string with backslash-escapes.
function escapeForSingleQuotedJs(json) {
  return json.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const dataOut = `// ==================== SENTENCE DATABASE (JSON-parsed for fast mobile load) ====================
// Stored as a JSON string + JSON.parse. V8/JSC parse JSON much faster than the
// equivalent object literal (often 1.5-3x speedup on 5000+ element collections).
// Do NOT hand-edit the string below; regenerate via .cursor/convert-to-json.js.
const SENTENCES = JSON.parse('${escapeForSingleQuotedJs(sentencesJson)}');
`;

const dictOut = `// ==================== WORD DICTIONARY (JSON-parsed for fast mobile load) ====================
// Stored as a JSON string + JSON.parse for faster parse on mobile.
// Do NOT hand-edit the string below; regenerate via .cursor/convert-to-json.js.
const DICTIONARY = JSON.parse('${escapeForSingleQuotedJs(dictionaryJson)}');

// Notify listeners (word popup may have been opened before this file finished loading)
try {
  window.DICTIONARY = DICTIONARY;
  window.__dictionaryReady = true;
  if (typeof window.__onDictionaryReady === 'function') window.__onDictionaryReady();
} catch (_) {}
`;

fs.writeFileSync(path.join(ROOT, 'js/data.js'), dataOut);
fs.writeFileSync(path.join(ROOT, 'js/dictionary.js'), dictOut);

console.log('\nWrote new js/data.js and js/dictionary.js');
console.log(`  data.js size: ${dataOut.length} bytes`);
console.log(`  dictionary.js size: ${dictOut.length} bytes`);
