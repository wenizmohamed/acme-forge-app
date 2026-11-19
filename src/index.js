/**
 * ACME Decisions Layer & Command Center — Atlassian Forge Backend Entrypoint
 *
 * Exports:
 *  - `handler`: `@forge/resolver` handler for Jira Global Page, Confluence Global Page, and Confluence Macro Custom UI
 *  - `approveDecisionCard`: Rovo Agent action handler (`approve-decision-card`)
 *  - `holdDecisionCard`: Rovo Agent action handler (`hold-decision-card`)
 *  - `queryAcmeSignals`: Rovo Agent action handler (`query-acme-signals`)
 *  - `listDecisionAuditLog`: Rovo Agent action handler (`list-decision-audit-log`)
 *  - `mcpHandler`: Forge Webtrigger JSON-RPC 2.0 MCP endpoint
 *  - `createAcmeService`: Factory with dependency injection for automated unit testing
 */

import ResolverPkg from '@forge/resolver';
import api from '@forge/api';
import { kvs } from '@forge/kvs';

const Resolver = ResolverPkg?.default ?? ResolverPkg;
import {
  DECISION_CARDS,
  MARKET_SIGNALS,
  MCP_TOOLS,
  FORGE_APP_ID,
  findDecisionCard
} from './catalog.js';
import {
  buildAuditEntry,
  buildRovoDecisionCardResponse,
  buildTeamworkGraphLinks
} from './builders.js';
import {
  getAuditLog,
  appendAuditEntry,
  getDecisionStates,
  saveDecisionState,
  getWorkspaceConfig,
  saveWorkspaceConfig
} from './storage.js';
import {
  createJiraDecisionIssue,
  publishConfluenceDecisionPage
} from './atlassian.js';
import { handleMcpRequest } from './mcp.js';

/**
 * Creates the core ACME Decisions Forge service with injectable dependencies
 * (`apiClient`, `store`, `now`) so unit tests run deterministically offline
 * while production uses real `@forge/api` + `@forge/kvs`.
 */
export function createAcmeService({
  apiClient = api,
  store = kvs,
  now = () => new Date().toISOString()
} = {}) {
  async function queryAcmeSignals(payload = {}, context = {}) {
    const category = String(payload?.category || 'all').trim().toLowerCase();
    const [states, auditLog, config] = await Promise.all([
      getDecisionStates(store),
      getAuditLog(store, { limit: 20 }),
      getWorkspaceConfig(store)
    ]);

    const cards = DECISION_CARDS.filter(
      (c) => category === 'all' || c.category === category
    ).map((c) => {
      const persisted = states[c.id] || null;
      return {
        ...c,
        status: persisted?.status || 'PENDING',
        jiraIssueKey: persisted?.jiraIssueKey || null,
        confluencePageId: persisted?.confluencePageId || null,
        updatedAt: persisted?.updatedAt || null,
        teamworkGraphLinks: buildTeamworkGraphLinks({
          cloudId: context?.cloudId,
          jiraIssueKey: persisted?.jiraIssueKey,
          confluencePageId: persisted?.confluencePageId,
          card: c
        })
      };
    });

    return {
      ok: true,
      appId: FORGE_APP_ID,
      runtime: 'atlassian-forge-nodejs22',
      signals: MARKET_SIGNALS,
      decisionCards: cards,
      auditLogCount: auditLog.length,
      workspaceConfig: config,
      timestamp: now()
    };
  }

  async function approveDecisionCard(payload = {}, context = {}) {
    const cardId = payload?.cardId || payload?.id || payload?.title;
    const card = findDecisionCard(cardId) || {
      id: String(cardId || 'DEC-CUSTOM'),
      tag: payload?.tag || 'EXECUTIVE',
      category: 'custom',
      tone: '#0F766E',
      confidence: 85,
      conf: payload?.conf || '85%',
      title: payload?.title || `Decision ${cardId || 'Custom'}`,
      body: payload?.body || 'Executive decision approved via ACME Decisions Layer.',
      impact: payload?.projectedImpact || payload?.impact || 'Strategic impact tracked',
      approveMsg: payload?.approveMsg || 'Approved via ACME Decisions Layer.',
      ownerTeam: payload?.ownerTeam || 'ACME Executive Operations',
      jiraIssueType: 'Task',
      labels: ['acme-decision', 'rovo-approved'],
      teamworkGraphGoals: ['goal:acme-executive-governance']
    };

    const config = await getWorkspaceConfig(store);
    const timestamp = now();
    const actor = payload?.actor || context?.accountId || 'ACME Executive User';
    const projectKey = payload?.projectKey || config.projectKey || 'ACME';
    const spaceId = payload?.spaceId || config.spaceId || '';
    const decisionLogPageId = payload?.decisionLogPageId || config.decisionLogPageId || '';

    // 1. Live Jira Issue creation via api.asUser().requestJira('/rest/api/3/issue')
    const jiraResult = await createJiraDecisionIssue(
      card,
      {
        projectKey,
        issueType: config.defaultIssueType || 'Task',
        actor,
        rationale: payload?.rationale,
        siteUrl: context?.siteUrl,
        timestamp
      },
      apiClient
    );

    // 2. Live Confluence Decision Page creation or append via api.asUser().requestConfluence('/wiki/api/v2/pages')
    const confluenceResult = await publishConfluenceDecisionPage(
      card,
      jiraResult,
      {
        spaceId,
        decisionLogPageId,
        actor,
        rationale: payload?.rationale,
        timestamp
      },
      apiClient
    );

    // 3. Persist immutable Decision Audit Log & Card State in Forge KVS
    const auditEntry = buildAuditEntry({
      card,
      status: 'APPROVED',
      actor,
      rationale: payload?.rationale,
      timestamp,
      jiraResult,
      confluenceResult,
      cloudId: context?.cloudId
    });

    await appendAuditEntry(auditEntry, store);
    await saveDecisionState(
      card.id,
      {
        status: 'APPROVED',
        jiraIssueKey: jiraResult.key || null,
        jiraIssueUrl: jiraResult.browseUrl || null,
        confluencePageId: confluenceResult.id || null,
        confluencePageUrl: confluenceResult.webUrl || null,
        auditEntryId: auditEntry.id,
        updatedAt: timestamp
      },
      store
    );

    return buildRovoDecisionCardResponse({
      card,
      status: 'APPROVED',
      auditEntry,
      jiraResult,
      confluenceResult,
      cloudId: context?.cloudId
    });
  }

  async function holdDecisionCard(payload = {}, context = {}) {
    const cardId = payload?.cardId || payload?.id || payload?.title;
    const card = findDecisionCard(cardId);
    if (!card) {
      return {
        ok: false,
        error: `Unknown decision card: ${String(cardId || '')}`
      };
    }

    const timestamp = now();
    const actor = payload?.actor || context?.accountId || 'ACME Executive User';
    const rationale = payload?.rationale || 'Held, moved to weekly executive review with rationale attached.';

    const auditEntry = buildAuditEntry({
      card,
      status: 'HELD',
      actor,
      rationale,
      timestamp,
      jiraResult: { status: 'SKIPPED' },
      confluenceResult: { status: 'SKIPPED' },
      cloudId: context?.cloudId
    });

    await appendAuditEntry(auditEntry, store);
    await saveDecisionState(
      card.id,
      {
        status: 'HELD',
        rationale,
        auditEntryId: auditEntry.id,
        updatedAt: timestamp
      },
      store
    );

    return buildRovoDecisionCardResponse({
      card,
      status: 'HELD',
      auditEntry,
      jiraResult: { status: 'SKIPPED' },
      confluenceResult: { status: 'SKIPPED' },
      cloudId: context?.cloudId
    });
  }

  async function listDecisionAuditLog(payload = {}) {
    const limit = Number(payload?.limit) || 25;
    const entries = await getAuditLog(store, { limit });
    return {
      ok: true,
      count: entries.length,
      entries,
      storage: '@forge/kvs'
    };
  }

  async function getBootstrap(payload = {}, context = {}) {
    const [signalsBundle, auditBundle] = await Promise.all([
      queryAcmeSignals(payload, context),
      listDecisionAuditLog({ limit: 25 })
    ]);
    return {
      ok: true,
      mode: 'FORGE_LIVE',
      appId: FORGE_APP_ID,
      cloudId: context?.cloudId || null,
      accountId: context?.accountId || null,
      signals: signalsBundle.signals,
      decisionCards: signalsBundle.decisionCards,
      auditLog: auditBundle.entries,
      workspaceConfig: signalsBundle.workspaceConfig,
      mcpTools: MCP_TOOLS
    };
  }

  async function updateWorkspaceConfig(payload = {}) {
    const config = await saveWorkspaceConfig(payload, store);
    return { ok: true, workspaceConfig: config };
  }

  async function mcpHandler(req) {
    return handleMcpRequest(req, {
      queryAcmeSignals,
      approveDecisionCard,
      holdDecisionCard,
      listDecisionAuditLog
    });
  }

  return {
    queryAcmeSignals,
    approveDecisionCard,
    holdDecisionCard,
    listDecisionAuditLog,
    getBootstrap,
    updateWorkspaceConfig,
    mcpHandler
  };
}

// Default production singleton wired to real @forge/api and @forge/kvs
const defaultService = createAcmeService();

// Custom UI Resolver definitions (`@forge/resolver`)
const resolver = new Resolver();
resolver.define('getBootstrap', ({ payload, context }) => defaultService.getBootstrap(payload, context));
resolver.define('querySignals', ({ payload, context }) => defaultService.queryAcmeSignals(payload, context));
resolver.define('approveDecision', ({ payload, context }) => defaultService.approveDecisionCard(payload, context));
resolver.define('holdDecision', ({ payload, context }) => defaultService.holdDecisionCard(payload, context));
resolver.define('getAuditLog', ({ payload }) => defaultService.listDecisionAuditLog(payload));
resolver.define('saveWorkspaceConfig', ({ payload }) => defaultService.updateWorkspaceConfig(payload));
resolver.define('listMcpTools', () => ({ ok: true, tools: MCP_TOOLS }));

export const handler = resolver.getDefinitions();

// Rovo Agent Action & Webtrigger exports (exact handler names referenced in manifest.yml)
export const approveDecisionCard = (payload, context) =>
  defaultService.approveDecisionCard(payload, context);

export const holdDecisionCard = (payload, context) =>
  defaultService.holdDecisionCard(payload, context);

export const queryAcmeSignals = (payload, context) =>
  defaultService.queryAcmeSignals(payload, context);

export const listDecisionAuditLog = (payload, context) =>
  defaultService.listDecisionAuditLog(payload, context);

export const mcpHandler = (req) => defaultService.mcpHandler(req);
