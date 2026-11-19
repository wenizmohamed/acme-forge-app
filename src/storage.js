/**
 * Persistent Forge Key-Value Store (@forge/kvs) wrapper for:
 *  - Decision Audit Log (`acme:decision-audit-log`)
 *  - Decision Card Status Map (`acme:decision-states`)
 *  - Workspace Integration Config (`acme:workspace-config`)
 *
 * Accepts an injectable `store` parameter for deterministic unit testing
 * while defaulting to real `@forge/kvs` in the Forge runtime.
 */

import { kvs } from '@forge/kvs';
import { SEED_AUDIT_LOG } from './catalog.js';

export const KVS_KEYS = {
  AUDIT_LOG: 'acme:decision-audit-log',
  DECISION_STATES: 'acme:decision-states',
  WORKSPACE_CONFIG: 'acme:workspace-config'
};

const MAX_AUDIT_ENTRIES = 100;

export async function getWorkspaceConfig(store = kvs) {
  const saved = await store.get(KVS_KEYS.WORKSPACE_CONFIG);
  return {
    projectKey: saved?.projectKey || 'ACME',
    spaceId: saved?.spaceId || '',
    decisionLogPageId: saved?.decisionLogPageId || '',
    defaultIssueType: saved?.defaultIssueType || 'Task',
    updatedAt: saved?.updatedAt || null
  };
}

export async function saveWorkspaceConfig(patch, store = kvs) {
  const current = await getWorkspaceConfig(store);
  const next = {
    projectKey: (patch?.projectKey ?? current.projectKey ?? 'ACME').trim().toUpperCase() || 'ACME',
    spaceId: String(patch?.spaceId ?? current.spaceId ?? '').trim(),
    decisionLogPageId: String(patch?.decisionLogPageId ?? current.decisionLogPageId ?? '').trim(),
    defaultIssueType: String(patch?.defaultIssueType ?? current.defaultIssueType ?? 'Task').trim() || 'Task',
    updatedAt: new Date().toISOString()
  };
  await store.set(KVS_KEYS.WORKSPACE_CONFIG, next);
  return next;
}

export async function getAuditLog(store = kvs, { limit = 25, includeSeed = true } = {}) {
  const raw = await store.get(KVS_KEYS.AUDIT_LOG);
  const stored = Array.isArray(raw) ? raw : [];
  const merged = stored.length > 0 ? stored : includeSeed ? [...SEED_AUDIT_LOG] : [];
  return merged.slice(0, Math.max(1, Math.min(Number(limit) || 25, MAX_AUDIT_ENTRIES)));
}

export async function appendAuditEntry(entry, store = kvs) {
  const raw = await store.get(KVS_KEYS.AUDIT_LOG);
  const existing = Array.isArray(raw) && raw.length > 0 ? raw : [...SEED_AUDIT_LOG];
  const deduped = existing.filter((item) => item.id !== entry.id);
  const next = [entry, ...deduped].slice(0, MAX_AUDIT_ENTRIES);
  await store.set(KVS_KEYS.AUDIT_LOG, next);
  return next;
}

export async function getDecisionStates(store = kvs) {
  const raw = await store.get(KVS_KEYS.DECISION_STATES);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

export async function saveDecisionState(cardId, state, store = kvs) {
  const states = await getDecisionStates(store);
  const next = {
    ...states,
    [cardId]: {
      ...state,
      cardId,
      updatedAt: state.updatedAt || new Date().toISOString()
    }
  };
  await store.set(KVS_KEYS.DECISION_STATES, next);
  return next[cardId];
}

/**
 * Helper for tests & preview adapters: in-memory KVS implementation matching `@forge/kvs`.
 */
export function createMemoryStore(initialData = {}) {
  const map = new Map(Object.entries(initialData));
  return {
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : undefined;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async delete(key) {
      map.delete(key);
    },
    _dump() {
      return Object.fromEntries(map.entries());
    }
  };
}
