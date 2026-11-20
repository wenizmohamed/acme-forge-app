/**
 * Static Atlassian Forge manifest, scope parity, Rovo action binding,
 * handler export, resource path, and open-source LICENSE validator.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORGE_SCOPES } from '../src/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const manifestPath = path.join(root, 'manifest.yml');
const manifestText = fs.readFileSync(manifestPath, 'utf-8');

const errors = [];

const requiredModules = [
  'rovo:agent:',
  'action:',
  'jira:globalPage:',
  'confluence:globalPage:',
  'macro:',
  'webtrigger:',
  'function:'
];

for (const mod of requiredModules) {
  if (!manifestText.includes(mod)) {
    errors.push(`Missing required Forge module block: ${mod}`);
  }
}

// Extract exact scopes from manifest.yml
const scopesBlockMatch = manifestText.match(/scopes:\s*\r?\n((?:\s+-\s+[^\r\n]+\r?\n?)+)/);
const manifestScopes = scopesBlockMatch
  ? [...scopesBlockMatch[1].matchAll(/-\s+([^\s#]+)/g)].map((m) => m[1].trim())
  : [];

const catalogScopes = FORGE_SCOPES.map((s) => s.scope);
for (const scope of catalogScopes) {
  if (!manifestScopes.includes(scope)) {
    errors.push(`Missing required least-privilege Forge scope in manifest.yml: ${scope}`);
  }
}
for (const scope of manifestScopes) {
  if (!catalogScopes.includes(scope)) {
    errors.push(`Undocumented scope in manifest.yml not present in FORGE_SCOPES: ${scope}`);
  }
}

if (!/runtime:\s*\r?\n\s*name:\s*nodejs22\.x/.test(manifestText)) {
  errors.push('Expected app.runtime.name to be nodejs22.x');
}

if (!/id:\s*ari:cloud:ecosystem::app\/1ccdf603-166b-400f-b0d9-6f6dab65f91a/.test(manifestText)) {
  errors.push('Missing or modified Atlassian Forge App ID');
}

// Verify every handler referenced in manifest.yml exists in src/index.js
const handlerMatches = [...manifestText.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
if (handlerMatches.length === 0) {
  errors.push('No function handlers declared in manifest.yml');
}

const indexSource = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf-8');
for (const fnName of handlerMatches) {
  const exportRe = new RegExp(`export\\s+(const|async\\s+function|function)\\s+${fnName}\\b`);
  if (!exportRe.test(indexSource)) {
    errors.push(`Handler index.${fnName} declared in manifest.yml is not exported by src/index.js`);
  }
}

// Verify every Rovo Agent action key is declared in the action: block
const agentActionsBlock = manifestText.match(/actions:\s*\r?\n((?:\s+-\s+[^\r\n]+\r?\n?)+)/);
const agentActions = agentActionsBlock
  ? [...agentActionsBlock[1].matchAll(/-\s+([a-z0-9-]+)/g)].map((m) => m[1])
  : [];
if (agentActions.length < 4) {
  errors.push(`Expected at least 4 Rovo agent actions, found ${agentActions.length}`);
}
for (const actKey of agentActions) {
  const keyRe = new RegExp(`-\\s+key:\\s*${actKey}\\b`);
  if (!keyRe.test(manifestText)) {
    errors.push(`Rovo agent references undeclared action key: ${actKey}`);
  }
}

// Verify resource path exists
const resourcePathMatch = manifestText.match(/path:\s*(.+)/);
if (resourcePathMatch) {
  const resDir = path.join(root, resourcePathMatch[1].trim());
  if (!fs.existsSync(path.join(resDir, 'index.html'))) {
    errors.push(`Resource directory missing index.html: ${resourcePathMatch[1].trim()}`);
  }
}

// Verify MIT LICENSE file exists at repo root
const licensePath = path.join(root, 'LICENSE');
if (!fs.existsSync(licensePath)) {
  errors.push('Missing root LICENSE file');
} else {
  const licText = fs.readFileSync(licensePath, 'utf-8');
  if (!/MIT License/i.test(licText)) {
    errors.push('Root LICENSE file does not contain MIT License header');
  }
}

if (errors.length > 0) {
  console.error('Manifest validation FAILED:');
  for (const err of errors) console.error('  -', err);
  process.exit(1);
}

console.log(
  `Manifest validation PASSED: ${requiredModules.length} module families, ${manifestScopes.length} least-privilege scopes, ${agentActions.length} Rovo actions, ${handlerMatches.length} verified handlers, MIT LICENSE present.`
);
