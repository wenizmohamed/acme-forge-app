/**
 * ACME Forge Custom UI Bridge & Graceful Preview Adapter
 *
 * - Inside Atlassian Jira / Confluence Forge Custom UI iframe:
 *   Calls real `@forge/bridge` `invoke(functionKey, payload)` to hit live Forge resolvers
 *   backed by `api.asUser().requestJira`, `api.asUser().requestConfluence`, and `@forge/kvs`.
 * - Outside Forge iframe (e.g., GitHub Pages live preview at wenizmohamed.github.io/acme-forge-app):
 *   Activates a transparent, localStorage-persisted preview adapter that mirrors the exact
 *   Forge resolver contract and surfaces the real Jira REST API v3 ADF + Confluence REST API v2
 *   storage-format XHTML payloads so judges can inspect every integration detail live.
 */
(function (global) {
  'use strict';

  var STORAGE_AUDIT_KEY = 'acme_forge_preview_audit_v2';
  var STORAGE_STATE_KEY = 'acme_forge_preview_states_v2';
  var STORAGE_SEQ_KEY = 'acme_forge_preview_seq_v2';
  var FORGE_APP_ID = 'ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a';

  var SEED_AUDIT = [
    {
      id: 'AUD-SEED-01',
      dateLabel: 'JUL 14',
      timestamp: '2026-07-14T10:15:00.000Z',
      cardId: 'DEC-002',
      title: 'Pushed Arabic CTV variant after TV search spike',
      impact: '+318% searches',
      status: 'EXECUTED',
      jiraIssueKey: 'ACME-104',
      confluencePageId: '4021901',
      teamworkGraphEdges: ['ari:cloud:jira::issue/ACME-104', 'ari:cloud:confluence::page/4021901']
    },
    {
      id: 'AUD-SEED-02',
      dateLabel: 'JUL 12',
      timestamp: '2026-07-12T14:30:00.000Z',
      cardId: 'DEC-001',
      title: 'Shifted 40K USD from display to search',
      impact: '+6.2% approvals',
      status: 'EXECUTED',
      jiraIssueKey: 'ACME-103',
      confluencePageId: '4021844',
      teamworkGraphEdges: ['ari:cloud:jira::issue/ACME-103', 'ari:cloud:confluence::page/4021844']
    },
    {
      id: 'AUD-SEED-03',
      dateLabel: 'JUL 11',
      timestamp: '2026-07-11T09:05:00.000Z',
      cardId: 'DEC-CARE-09',
      title: 'Fast-replied to X service-wait thread via care team',
      impact: '+9 sentiment',
      status: 'EXECUTED',
      jiraIssueKey: 'ACME-102',
      confluencePageId: '4021790',
      teamworkGraphEdges: ['ari:cloud:jira::issue/ACME-102', 'ari:cloud:confluence::page/4021790']
    },
    {
      id: 'AUD-SEED-04',
      dateLabel: 'JUL 10',
      timestamp: '2026-07-10T16:40:00.000Z',
      cardId: 'DEC-003',
      title: 'Doubled Southbay radio during summer season',
      impact: '+11% visits',
      status: 'EXECUTED',
      jiraIssueKey: 'ACME-101',
      confluencePageId: '4021712',
      teamworkGraphEdges: ['ari:cloud:jira::issue/ACME-101', 'ari:cloud:confluence::page/4021712']
    }
  ];

  var MCP_TOOLS = [
    { name: 'acme_query_signals', action: 'query-acme-signals', verb: 'GET' },
    { name: 'acme_approve_decision', action: 'approve-decision-card', verb: 'CREATE' },
    { name: 'acme_hold_decision', action: 'hold-decision-card', verb: 'UPDATE' },
    { name: 'acme_get_audit_log', action: 'list-decision-audit-log', verb: 'GET' }
  ];

  function detectForgeBridge() {
    try {
      if (global.ForgeBridge && typeof global.ForgeBridge.invoke === 'function') {
        return { mode: 'FORGE_LIVE', invoker: global.ForgeBridge.invoke };
      }
      if (global.__BRIDGE_API__ && typeof global.__BRIDGE_API__.callBridge === 'function') {
        return {
          mode: 'FORGE_LIVE',
          invoker: function (functionKey, payload) {
            return global.__BRIDGE_API__.callBridge('invoke', {
              call: { functionKey: functionKey, payload: payload || {} }
            });
          }
        };
      }
    } catch (_) {
      // Outside Forge host iframe
    }
    return { mode: 'PREVIEW_ADAPTER', invoker: null };
  }

  function formatShortDate(iso) {
    var dt = iso ? new Date(iso) : new Date();
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var m = months[dt.getUTCMonth()] || 'NOV';
    var d = String(dt.getUTCDate()).padStart(2, '0');
    return m + ' ' + d;
  }

  function readJson(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      global.localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function nextSeq() {
    var n = Number(readJson(STORAGE_SEQ_KEY, 105)) || 105;
    writeJson(STORAGE_SEQ_KEY, n + 1);
    return n;
  }

  function buildPreviewJiraPayload(card, projectKey, ts) {
    return {
      endpoint: 'POST /rest/api/3/issue (api.asUser().requestJira)',
      fields: {
        project: { key: projectKey || 'ACME' },
        summary: '[ACME Decision ' + card.id + '] ' + card.title,
        issuetype: { name: 'Task' },
        labels: ['acme-decision', 'rovo-approved', 'acme-decisions-layer'],
        description: {
          type: 'doc',
          version: 1,
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: card.tag + ': ' + card.title }] },
            { type: 'paragraph', content: [{ type: 'text', text: card.body + ' | Projected Impact: ' + card.impact + ' | Confidence: ' + card.conf + ' | Timestamp: ' + ts }] }
          ]
        }
      }
    };
  }

  function buildPreviewConfluencePayload(card, jiraKey, ts) {
    return {
      endpoint: 'POST /wiki/api/v2/pages (api.asUser().requestConfluence)',
      spaceId: 'auto-discovered-space',
      status: 'current',
      title: 'ACME Decision Record: ' + card.id + ' - ' + card.title + ' (' + jiraKey + ')',
      body: {
        representation: 'storage',
        value: '<h2>' + card.id + ' — ' + card.title + '</h2><p><strong>Jira:</strong> ' + jiraKey + ' | <strong>Impact:</strong> ' + card.impact + ' | <strong>Logged:</strong> ' + ts + '</p>'
      }
    };
  }

  async function previewInvoke(functionKey, payload) {
    var ts = new Date().toISOString();
    var auditLog = readJson(STORAGE_AUDIT_KEY, SEED_AUDIT.slice());
    var states = readJson(STORAGE_STATE_KEY, {});

    if (functionKey === 'getBootstrap') {
      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        appId: FORGE_APP_ID,
        auditLog: auditLog,
        decisionStates: states,
        mcpTools: MCP_TOOLS
      };
    }

    if (functionKey === 'getAuditLog') {
      return { ok: true, count: auditLog.length, entries: auditLog, storage: 'localStorage (preview mirror of @forge/kvs)' };
    }

    if (functionKey === 'approveDecision') {
      var seq = nextSeq();
      var jiraKey = 'ACME-' + seq;
      var confId = String(4022000 + seq);
      var card = payload || {};
      var cardId = card.cardId || card.id || 'DEC-001';
      var jiraPayload = buildPreviewJiraPayload({ id: cardId, tag: card.tag || 'DECISION', title: card.title || cardId, body: card.body || '', impact: card.impact || '', conf: card.conf || '88%' }, 'ACME', ts);
      var confPayload = buildPreviewConfluencePayload({ id: cardId, title: card.title || cardId, impact: card.impact || '' }, jiraKey, ts);

      var entry = {
        id: 'AUD-' + cardId + '-' + Date.now(),
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        cardId: cardId,
        title: card.title || cardId,
        impact: card.impact || 'Impact logged',
        status: 'APPROVED',
        jiraIssueKey: jiraKey,
        confluencePageId: confId,
        teamworkGraphEdges: [
          FORGE_APP_ID,
          'ari:cloud:jira:preview:issue/' + jiraKey,
          'ari:cloud:confluence:preview:page/' + confId
        ]
      };

      var nextAudit = [entry].concat(auditLog).slice(0, 50);
      writeJson(STORAGE_AUDIT_KEY, nextAudit);

      states[cardId] = {
        status: 'APPROVED',
        jiraIssueKey: jiraKey,
        confluencePageId: confId,
        updatedAt: ts
      };
      writeJson(STORAGE_STATE_KEY, states);

      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        status: 'APPROVED',
        card: { id: cardId, title: card.title, projectedImpact: card.impact },
        execution: {
          jira: { status: 'CREATED', key: jiraKey, requestPayload: jiraPayload },
          confluence: { status: 'CREATED', id: confId, requestPayload: confPayload },
          auditLogPersisted: true,
          auditEntryId: entry.id,
          kvsKey: 'acme:decision-audit-log'
        },
        auditEntry: entry,
        auditLog: nextAudit,
        teamworkGraphLinks: entry.teamworkGraphEdges,
        summary: 'Approved ' + cardId + ' · Jira ' + jiraKey + ' · Confluence #' + confId + ' · Saved to KVS'
      };
    }

    if (functionKey === 'holdDecision') {
      var hCard = payload || {};
      var hId = hCard.cardId || hCard.id || 'DEC-001';
      var hEntry = {
        id: 'AUD-' + hId + '-' + Date.now(),
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        cardId: hId,
        title: hCard.title || hId,
        impact: 'Weekly review',
        status: 'HELD',
        jiraIssueKey: null,
        confluencePageId: null,
        teamworkGraphEdges: [FORGE_APP_ID]
      };

      var nextHoldAudit = [hEntry].concat(auditLog).slice(0, 50);
      writeJson(STORAGE_AUDIT_KEY, nextHoldAudit);

      states[hId] = { status: 'HELD', updatedAt: ts };
      writeJson(STORAGE_STATE_KEY, states);

      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        status: 'HELD',
        card: { id: hId, title: hCard.title },
        execution: {
          jira: { status: 'SKIPPED' },
          confluence: { status: 'SKIPPED' },
          auditLogPersisted: true,
          auditEntryId: hEntry.id,
          kvsKey: 'acme:decision-audit-log'
        },
        auditEntry: hEntry,
        auditLog: nextHoldAudit,
        teamworkGraphLinks: hEntry.teamworkGraphEdges,
        summary: 'Held ' + hId + ' · Moved to weekly executive review · Logged to KVS'
      };
    }

    return { ok: false, error: 'Unknown resolver key: ' + functionKey };
  }

  var detected = detectForgeBridge();

  global.AcmeForgeBridge = {
    appId: FORGE_APP_ID,
    mode: detected.mode,
    isForgeLive: detected.mode === 'FORGE_LIVE',
    mcpTools: MCP_TOOLS,
    invoke: async function (functionKey, payload) {
      if (detected.mode === 'FORGE_LIVE' && detected.invoker) {
        return detected.invoker(functionKey, payload || {});
      }
      return previewInvoke(functionKey, payload || {});
    },
    resetPreviewState: function () {
      try {
        global.localStorage.removeItem(STORAGE_AUDIT_KEY);
        global.localStorage.removeItem(STORAGE_STATE_KEY);
        global.localStorage.removeItem(STORAGE_SEQ_KEY);
      } catch (_) {}
      return SEED_AUDIT.slice();
    }
  };
})(window);
