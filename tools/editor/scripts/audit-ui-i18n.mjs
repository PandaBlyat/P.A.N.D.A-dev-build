import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const ROOT = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT, 'src');
const I18N_FILE = path.join(SRC_DIR, 'lib', 'i18n.ts');

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
}

function listSourceFiles(dir) {
  const out = [];
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
    }
  }
  return out;
}

function parseFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2022, true, kind);
}

function getStringLiteral(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function unwrap(expr) {
  let current = expr;
  while (current) {
    if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isTypeAssertionExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return current;
}

function extractConstArrayLiteral(node) {
  const unwrapped = unwrap(node);
  if (!unwrapped || !ts.isArrayLiteralExpression(unwrapped)) return null;
  const values = [];
  for (const element of unwrapped.elements) {
    const value = getStringLiteral(element);
    if (value == null) return null;
    values.push(value);
  }
  return values;
}

function extractRecordLiteral(node) {
  const unwrapped = unwrap(node);
  if (!unwrapped || !ts.isObjectLiteralExpression(unwrapped)) return null;
  const out = new Map();
  for (const prop of unwrapped.properties) {
    if (!ts.isPropertyAssignment(prop)) return null;
    const name = prop.name;
    const key = ts.isIdentifier(name) ? name.text : getStringLiteral(name);
    if (key == null) return null;
    const value = getStringLiteral(prop.initializer);
    if (value == null) return null;
    out.set(key, value);
  }
  return out;
}

function extractStringsObject(node) {
  const unwrapped = unwrap(node);
  if (!unwrapped || !ts.isObjectLiteralExpression(unwrapped)) return null;
  const tables = new Map();
  for (const prop of unwrapped.properties) {
    if (!ts.isPropertyAssignment(prop)) return null;
    const lang = ts.isIdentifier(prop.name) ? prop.name.text : getStringLiteral(prop.name);
    if (lang == null) return null;
    const table = extractRecordLiteral(prop.initializer);
    if (!table) return null;
    tables.set(lang, table);
  }
  return tables;
}

function extractI18nTables(i18nSource) {
  let keys = null;
  let stringsEn = null;
  let stringsRu = null;

  i18nSource.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (decl.name.text === 'I18N_KEYS') keys = extractConstArrayLiteral(decl.initializer);
      if (decl.name.text === 'STRINGS') {
        const tables = extractStringsObject(decl.initializer);
        if (tables) {
          stringsEn = tables.get('en') ?? null;
          stringsRu = tables.get('ru') ?? null;
        }
      }
    }
  });

  return { keys, stringsEn, stringsRu };
}

function scanTUsage(source) {
  const used = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const first = node.arguments[0];
      const value = first ? getStringLiteral(first) : null;
      if (value) used.add(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return used;
}

function isSuspiciousUiLiteral(text) {
  if (!text) return false;
  if (text.length <= 1) return false;
  // allowlist: icon glyphs, separators, punctuation, roman numerals, counters
  if (/^[\s·•—–\-_/#*+×✓✕….,:;!?(){}\[\]<>|\\]+$/.test(text)) return false;
  if (/^[IVXLCDM]+$/.test(text)) return false;
  if (/^#[0-9]+$/.test(text)) return false;
  // flag anything with ascii words
  if (/[A-Za-z]{2,}/.test(text)) return true;
  return false;
}

function scanSuspiciousUiStrings(source) {
  const findings = [];

  const watchedProps = new Set(['textContent', 'placeholder', 'title', 'ariaLabel']);
  const watchedAttrs = new Set(['aria-label', 'title', 'placeholder']);

  function push(node, kind, value) {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({
      file: source.fileName,
      line: line + 1,
      col: character + 1,
      kind,
      value,
    });
  }

  function visit(node) {
    // element.textContent = '...'
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isPropertyAccessExpression(node.left) && ts.isIdentifier(node.left.name)) {
        const prop = node.left.name.text;
        if (watchedProps.has(prop)) {
          const value = getStringLiteral(node.right);
          if (value && isSuspiciousUiLiteral(value)) push(node, `assign:${prop}`, value);
        }
      }
    }

    // element.setAttribute('aria-label', '...')
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name;
      if (ts.isIdentifier(name) && name.text === 'setAttribute') {
        const attr = node.arguments[0] ? getStringLiteral(node.arguments[0]) : null;
        const value = node.arguments[1] ? getStringLiteral(node.arguments[1]) : null;
        if (attr && watchedAttrs.has(attr) && value && isSuspiciousUiLiteral(value)) {
          push(node, `attr:${attr}`, value);
        }
      }
    }

    // setButtonContent(btn, icon, '...')
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'setButtonContent') {
      const value = node.arguments[2] ? getStringLiteral(node.arguments[2]) : null;
      if (value && isSuspiciousUiLiteral(value)) push(node, 'setButtonContent', value);
    }

    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function scanMojibakeMarkers(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const markers = ['Ð', 'Ñ', 'ðŸ', 'â€”', 'â€', '\uFFFD'];
  return markers.some((m) => text.includes(m));
}

const i18nSource = parseFile(I18N_FILE);
const { keys, stringsEn, stringsRu } = extractI18nTables(i18nSource);

if (!keys) fail(`i18n: missing I18N_KEYS in ${I18N_FILE}`);
if (!stringsEn || !stringsRu) fail(`i18n: missing STRINGS.en/ru in ${I18N_FILE}`);

const keySet = new Set(keys ?? []);
if (keys && keySet.size !== keys.length) fail('i18n: duplicate keys in I18N_KEYS');

for (const k of keys ?? []) {
  if (!stringsEn?.has(k)) fail(`i18n: missing en value for key "${k}"`);
  if (!stringsRu?.has(k)) fail(`i18n: missing ru value for key "${k}"`);
}
for (const k of stringsEn?.keys() ?? []) {
  if (!keySet.has(k)) fail(`i18n: en has extra key not in I18N_KEYS: "${k}"`);
}
for (const k of stringsRu?.keys() ?? []) {
  if (!keySet.has(k)) fail(`i18n: ru has extra key not in I18N_KEYS: "${k}"`);
}

const files = listSourceFiles(SRC_DIR);
const usedKeys = new Set();
const suspicious = [];
const mojibakeFiles = [];

for (const file of files) {
  if (file === I18N_FILE) continue;
  const source = parseFile(file);
  for (const k of scanTUsage(source)) usedKeys.add(k);
  suspicious.push(...scanSuspiciousUiStrings(source));
  if (scanMojibakeMarkers(file)) mojibakeFiles.push(file);
}

for (const k of keys ?? []) {
  if (!usedKeys.has(k)) fail(`i18n: unused key "${k}"`);
}
for (const k of usedKeys) {
  if (!keySet.has(k)) fail(`i18n: t() used unknown key "${k}"`);
}

if (suspicious.length) {
  fail('i18n: suspicious raw UI strings (localize via t(...)):\n' + suspicious
    .map((f) => `- ${path.relative(ROOT, f.file)}:${f.line}:${f.col} [${f.kind}] "${f.value}"`)
    .join('\n'));
}

if (mojibakeFiles.length) {
  fail('i18n: mojibake markers detected (save as UTF-8, fix literals):\n' + mojibakeFiles
    .map((f) => `- ${path.relative(ROOT, f)}`)
    .join('\n'));
}

if (process.exitCode) process.exit(process.exitCode);

