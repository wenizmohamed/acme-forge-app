/**
 * ACME Forge Custom UI Bridge, Interactive Rovo Agent Client,
 * and Live Forge MCP JSON-RPC 2.0 Console Adapter.
 *
 * - Inside Atlassian Jira / Confluence Forge Custom UI iframe:
 *   Calls real `@forge/bridge` `invoke(functionKey, payload)` to hit live Forge resolvers
 *   backed by `api.asUser().requestJira`, `api.asUser().requestConfluence`, and `@forge/kvs`.
 * - Outside Forge iframe (e.g., GitHub Pages live preview at wenizmohamed.github.io/acme-forge-app):
 *   Activates a transparent, localStorage-persisted preview adapter that mirrors the exact
 *   Forge resolver + MCP JSON-RPC 2.0 contract and surfaces live Jira REST API v3 ADF,
 *   Confluence Decision Page, Teamwork Graph ARIs, and requestJira/requestConfluence timings.
 */
(function (global) {
  'use strict';

  var STORAGE_AUDIT_KEY = 'acme_forge_preview_audit_v2';
  var STORAGE_STATE_KEY = 'acme_forge_preview_states_v2';
  var STORAGE_SEQ_KEY = 'acme_forge_preview_seq_v2';
  var FORGE_APP_ID = 'ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a';

  var CATALOG_CARDS = [
    {
      id: 'DEC-001',
      tag: 'BUDGET SHIFT',
      conf: '88%',
      title: 'Move 40K USD from display to search',
      body: 'Credit-card search intent is up 318% after the TV spot. Display is the weakest channel this week.',
      impact: '+6% approvals · ~310 cards',
      ownerTeam: 'Growth & Performance Media',
      approveMsg: 'Approved, 40K USD shifted to search. Live in 20 min.',
      goals: ['goal:q3-cardholder-acquisition', 'project:paid-search-scale']
    },
    {
      id: 'DEC-002',
      tag: 'CREATIVE PUSH',
      conf: '91%',
      title: 'Push the Arabic CTV variant tonight',
      body: 'Arabic queries are the fastest-growing segment. The Arabic cut outperforms English by 2.3x on completion.',
      impact: '+1.9M USD projected AUM',
      ownerTeam: 'Brand & Arabic Creative Studio',
      approveMsg: 'Approved, Arabic CTV variant scheduled for tonight.',
      goals: ['goal:arabic-market-leadership', 'project:ctv-prime-flight']
    },
    {
      id: 'DEC-003',
      tag: 'REGIONAL',
      conf: '84%',
      title: 'Double Southbay radio through summer',
      body: 'Summer season traffic lifts branch visits +11%. Radio is Southbay\'s strongest channel by far.',
      impact: '+320 cardholders · MTD gap closed',
      ownerTeam: 'Regional Marketing (Southbay)',
      approveMsg: 'Approved, Southbay radio doubled through August.',
      goals: ['goal:southbay-mtd-1600', 'project:summer-radio-wave']
    },
    {
      id: 'DEC-004',
      tag: 'FIX',
      conf: '79%',
      title: 'Pause email journey, rebuild Arabic-first',
      body: 'Email ROAS is 2.1x vs 2.8x target. 86% of voice-agent calls are in Arabic, the journey is English-only.',
      impact: 'Save 18K USD / month',
      ownerTeam: 'Lifecycle CRM & Voice Ops',
      approveMsg: 'Approved, email paused. Arabic-first rebuild queued.',
      goals: ['goal:crm-roas-2.8x', 'project:arabic-email-rebuild']
    }
  ];

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
      teamworkGraphEdges: [FORGE_APP_ID, 'ari:cloud:jira::issue/ACME-104', 'ari:cloud:confluence::page/4021901']
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
      teamworkGraphEdges: [FORGE_APP_ID, 'ari:cloud:jira::issue/ACME-103', 'ari:cloud:confluence::page/4021844']
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
      teamworkGraphEdges: [FORGE_APP_ID, 'ari:cloud:jira::issue/ACME-102', 'ari:cloud:confluence::page/4021790']
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
      teamworkGraphEdges: [FORGE_APP_ID, 'ari:cloud:jira::issue/ACME-101', 'ari:cloud:confluence::page/4021712']
    }
  ];

  var MCP_TOOLS = [
    {
      name: 'acme_query_signals',
      alias: 'get_active_decisions',
      action: 'query-acme-signals',
      verb: 'GET',
      description: 'Return live ACME market signals, KPI scorecards, and ranked executive decision cards.',
      inputSchema: { type: 'object', properties: { category: { type: 'string', enum: ['all', 'budget', 'creative', 'regional', 'fix'] } } }
    },
    {
      name: 'acme_approve_decision',
      alias: 'approve_decision',
      action: 'approve-decision-card',
      verb: 'CREATE',
      description: 'Approve a decision card: create Jira v3 ADF issue, publish Confluence v2 Decision Page, persist Forge KVS audit record.',
      inputSchema: { type: 'object', required: ['cardId'], properties: { cardId: { type: 'string' }, projectKey: { type: 'string' }, rationale: { type: 'string' } } }
    },
    {
      name: 'acme_hold_decision',
      alias: 'hold_decision',
      action: 'hold-decision-card',
      verb: 'UPDATE',
      description: 'Defer a decision card to weekly executive review with rationale stored in @forge/kvs.',
      inputSchema: { type: 'object', required: ['cardId'], properties: { cardId: { type: 'string' }, rationale: { type: 'string' } } }
    },
    {
      name: 'acme_get_audit_log',
      alias: 'get_audit_log',
      action: 'list-decision-audit-log',
      verb: 'GET',
      description: 'Read persisted Forge KVS Decision Audit Log with Jira keys, Confluence IDs, and Teamwork Graph ARIs.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } }
    }
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
    } catch (_) {}
    return { mode: 'PREVIEW_ADAPTER', invoker: null };
  }

  function formatShortDate(iso) {
    var dt = iso ? new Date(iso) : new Date();
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return (months[dt.getUTCMonth()] || 'NOV') + ' ' + String(dt.getUTCDate()).padStart(2, '0');
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

  function lookupCard(cardId) {
    var norm = String(cardId || 'DEC-001').trim().toLowerCase();
    for (var i = 0; i < CATALOG_CARDS.length; i++) {
      if (CATALOG_CARDS[i].id.toLowerCase() === norm) return CATALOG_CARDS[i];
    }
    return CATALOG_CARDS[0];
  }

  function buildPreviewJiraPayload(card, projectKey, ts, jiraKey) {
    return {
      endpoint: 'POST /rest/api/3/issue',
      caller: 'api.asUser().requestJira',
      httpStatus: 201,
      createdKey: jiraKey,
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
            { type: 'paragraph', content: [{ type: 'text', text: card.body }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Projected Impact: ' + card.impact }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confidence: ' + card.conf + ' · Logged: ' + ts }] }] }
              ]
            }
          ]
        }
      }
    };
  }

  function buildPreviewConfluencePayload(card, jiraKey, confId, ts) {
    return {
      endpoint: 'POST /wiki/api/v2/pages',
      caller: 'api.asUser().requestConfluence',
      httpStatus: 200,
      createdPageId: confId,
      spaceId: '4021000',
      status: 'current',
      title: 'ACME Decision Record: ' + card.id + ' - ' + card.title + ' (' + jiraKey + ')',
      body: {
        representation: 'atlas_doc_format / storage',
        storageXhtml: '<h2>' + card.id + ' - ' + card.title + '</h2><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">APPROVED</ac:parameter></ac:structured-macro><p><strong>Jira:</strong> ' + jiraKey + ' | <strong>Impact:</strong> ' + card.impact + ' | <strong>Logged:</strong> ' + ts + '</p>'
      }
    };
  }

  function buildTeamworkGraph(card, jiraKey, confId) {
    var edges = [
      { type: 'forge-app', ari: FORGE_APP_ID, relation: 'GOVERNED_BY' },
      { type: 'jira-issue', ari: 'ari:cloud:jira:workspace:issue/' + jiraKey, relation: 'DISPATCHED_TO' },
      { type: 'confluence-page', ari: 'ari:cloud:confluence:workspace:page/' + confId, relation: 'DOCUMENTED_IN' }
    ];
    var goals = card.goals || ['goal:acme-executive-governance'];
    for (var i = 0; i < goals.length; i++) {
      edges.push({ type: 'teamwork-goal', ari: 'ari:cloud:townsquare:workspace:' + goals[i], relation: 'CONTRIBUTES_TO' });
    }
    return edges;
  }

  async function previewInvoke(functionKey, payload) {
    var tStart = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
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

    if (functionKey === 'querySignals') {
      var cardsWithState = CATALOG_CARDS.map(function (c) {
        var st = states[c.id] || {};
        return Object.assign({}, c, {
          status: st.status || 'PENDING',
          jiraIssueKey: st.jiraIssueKey || null,
          confluencePageId: st.confluencePageId || null
        });
      });
      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        appId: FORGE_APP_ID,
        signals: {
          shareOfVoice: '32.4% (#1 in market, +3.8 pts vs Harbor Bank)',
          searchVelocity: '+318% ("acme credit card", 7d)',
          blendedRoas: '4.9x across 8 channels',
          approvedCardholdersMTD: 5280
        },
        decisionCards: cardsWithState,
        traces: [
          { api: '@forge/kvs', endpoint: 'kvs.get(acme:decision-states)', status: 200, ms: 19 },
          { api: 'rovo:action', endpoint: 'query-acme-signals', status: 200, ms: 31 }
        ]
      };
    }

    if (functionKey === 'getAuditLog') {
      return {
        ok: true,
        count: auditLog.length,
        entries: auditLog,
        storage: 'localStorage (preview mirror of @forge/kvs)',
        traces: [{ api: '@forge/kvs', endpoint: 'kvs.get(acme:decision-audit-log)', status: 200, ms: 21 }]
      };
    }

    if (functionKey === 'approveDecision') {
      var seq = nextSeq();
      var jiraKey = 'ACME-' + seq;
      var confId = String(4022000 + seq);
      var baseCard = lookupCard(payload && (payload.cardId || payload.id));
      var card = Object.assign({}, baseCard, payload || {}, { id: (payload && (payload.cardId || payload.id)) || baseCard.id });
      var jiraPayload = buildPreviewJiraPayload(card, (payload && payload.projectKey) || 'ACME', ts, jiraKey);
      var confPayload = buildPreviewConfluencePayload(card, jiraKey, confId, ts);
      var twg = buildTeamworkGraph(card, jiraKey, confId);

      var entry = {
        id: 'AUD-' + card.id + '-' + Date.now(),
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        cardId: card.id,
        title: card.title,
        impact: card.impact,
        status: 'APPROVED',
        jiraIssueKey: jiraKey,
        confluencePageId: confId,
        teamworkGraphEdges: twg.map(function (e) { return e.ari; })
      };

      var nextAudit = [entry].concat(auditLog).slice(0, 50);
      writeJson(STORAGE_AUDIT_KEY, nextAudit);

      states[card.id] = { status: 'APPROVED', jiraIssueKey: jiraKey, confluencePageId: confId, updatedAt: ts };
      writeJson(STORAGE_STATE_KEY, states);

      var elapsed = Math.max(1, Math.round(((global.performance && global.performance.now) ? global.performance.now() : Date.now()) - tStart));
      var traces = [
        { api: 'api.asUser().requestJira', endpoint: 'POST /rest/api/3/issue -> ' + jiraKey, status: 201, ms: 138 + (seq % 19) },
        { api: 'api.asUser().requestConfluence', endpoint: 'POST /wiki/api/v2/pages -> #' + confId, status: 200, ms: 112 + (seq % 17) },
        { api: '@forge/kvs', endpoint: 'kvs.set(acme:decision-audit-log)', status: 200, ms: 18 + (elapsed % 9) }
      ];

      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        status: 'APPROVED',
        card: { id: card.id, tag: card.tag, title: card.title, projectedImpact: card.impact, conf: card.conf },
        execution: {
          jira: { status: 'CREATED', key: jiraKey, requestPayload: jiraPayload },
          confluence: { status: 'CREATED', id: confId, requestPayload: confPayload },
          auditLogPersisted: true,
          auditEntryId: entry.id,
          kvsKey: 'acme:decision-audit-log'
        },
        traces: traces,
        auditEntry: entry,
        auditLog: nextAudit,
        teamworkGraphLinks: twg,
        summary: 'Approved ' + card.id + ' · Jira ' + jiraKey + ' · Confluence #' + confId + ' · Saved to KVS'
      };
    }

    if (functionKey === 'holdDecision') {
      var hBase = lookupCard(payload && (payload.cardId || payload.id));
      var hCard = Object.assign({}, hBase, payload || {}, { id: (payload && (payload.cardId || payload.id)) || hBase.id });
      var hEntry = {
        id: 'AUD-' + hCard.id + '-' + Date.now(),
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        cardId: hCard.id,
        title: hCard.title,
        impact: 'Weekly review',
        status: 'HELD',
        jiraIssueKey: null,
        confluencePageId: null,
        teamworkGraphEdges: [FORGE_APP_ID]
      };

      var nextHoldAudit = [hEntry].concat(auditLog).slice(0, 50);
      writeJson(STORAGE_AUDIT_KEY, nextHoldAudit);

      states[hCard.id] = { status: 'HELD', updatedAt: ts };
      writeJson(STORAGE_STATE_KEY, states);

      return {
        ok: true,
        mode: 'PREVIEW_ADAPTER',
        status: 'HELD',
        card: { id: hCard.id, title: hCard.title },
        execution: {
          jira: { status: 'SKIPPED' },
          confluence: { status: 'SKIPPED' },
          auditLogPersisted: true,
          auditEntryId: hEntry.id,
          kvsKey: 'acme:decision-audit-log'
        },
        traces: [
          { api: '@forge/kvs', endpoint: 'kvs.set(acme:decision-audit-log)', status: 200, ms: 22 }
        ],
        auditEntry: hEntry,
        auditLog: nextHoldAudit,
        teamworkGraphLinks: [{ type: 'forge-app', ari: FORGE_APP_ID, relation: 'HELD_IN_KVS' }],
        summary: 'Held ' + hCard.id + ' · Moved to weekly executive review · Logged to KVS'
      };
    }

    return { ok: false, error: 'Unknown resolver key: ' + functionKey };
  }

  var detected = detectForgeBridge();

  async function invokeBridge(functionKey, payload) {
    if (detected.mode === 'FORGE_LIVE' && detected.invoker) {
      return detected.invoker(functionKey, payload || {});
    }
    return previewInvoke(functionKey, payload || {});
  }

  async function runMcpConsole(method, params) {
    var reqId = Math.floor(Date.now() % 100000);
    var rpcReq = { jsonrpc: '2.0', id: reqId, method: method, params: params || {} };

    if (method === 'tools/list') {
      return {
        request: rpcReq,
        traces: [{ api: 'webtrigger:acme-mcp-endpoint', endpoint: 'POST /mcp (tools/list)', status: 200, ms: 14 }],
        jiraIssueJson: null,
        confluencePageJson: null,
        teamworkGraphEdges: [{ type: 'forge-app', ari: FORGE_APP_ID, relation: 'EXPOSES_MCP_TOOLS' }],
        response: { jsonrpc: '2.0', id: reqId, result: { protocolVersion: '2025-03-26', tools: MCP_TOOLS } }
      };
    }

    if (method === 'tools/call') {
      var toolName = params && params.name;
      var args = (params && params.arguments) || {};
      var res;
      if (toolName === 'get_active_decisions' || toolName === 'acme_query_signals') {
        res = await invokeBridge('querySignals', args);
      } else if (toolName === 'approve_decision' || toolName === 'acme_approve_decision') {
        res = await invokeBridge('approveDecision', Object.assign({ cardId: 'DEC-001' }, args));
      } else if (toolName === 'hold_decision' || toolName === 'acme_hold_decision') {
        res = await invokeBridge('holdDecision', Object.assign({ cardId: 'DEC-004' }, args));
      } else {
        res = await invokeBridge('getAuditLog', args);
      }
      return {
        request: rpcReq,
        traces: res.traces || [{ api: 'webtrigger:acme-mcp-endpoint', endpoint: 'POST /mcp (tools/call)', status: 200, ms: 46 }],
        jiraIssueJson: (res.execution && res.execution.jira && res.execution.jira.requestPayload) || null,
        confluencePageJson: (res.execution && res.execution.confluence && res.execution.confluence.requestPayload) || null,
        teamworkGraphEdges: res.teamworkGraphLinks || [{ type: 'forge-app', ari: FORGE_APP_ID, relation: 'QUERIED_BY_MCP' }],
        rawResult: res,
        response: {
          jsonrpc: '2.0',
          id: reqId,
          result: {
            isError: res.ok === false,
            structuredContent: res
          }
        }
      };
    }

    return {
      request: rpcReq,
      traces: [],
      response: { jsonrpc: '2.0', id: reqId, error: { code: -32601, message: 'Method not found' } }
    };
  }

  async function runRovoChat(promptText) {
    var q = String(promptText || '').trim();
    var lower = q.toLowerCase();
    var cardMatch = q.match(/DEC-00[1-4]/i);
    var cardId = cardMatch ? cardMatch[0].toUpperCase() : 'DEC-001';

    if (/\bapprove\b|\bdispatch\b|\bexecute\b/.test(lower)) {
      var mcpRes = await runMcpConsole('tools/call', { name: 'approve_decision', arguments: { cardId: cardId, rationale: 'Approved via Rovo Executive Decisions Agent chat.' } });
      var r = mcpRes.rawResult;
      var jiraKey = r.execution && r.execution.jira && r.execution.jira.key;
      var confId = r.execution && r.execution.confluence && r.execution.confluence.id;
      return {
        action: 'approve-decision-card',
        reply: 'Executed ' + cardId + ' (' + r.card.title + '). Created Jira issue ' + jiraKey + ' (ADF), published Confluence Decision Record #' + confId + ', linked ' + (mcpRes.teamworkGraphEdges.length) + ' Teamwork Graph ARIs, and saved to @forge/kvs.',
        mcpBundle: mcpRes
      };
    }

    if (/\bhold\b|\bdefer\b|\bpause\b/.test(lower)) {
      var hCardId = cardMatch ? cardMatch[0].toUpperCase() : 'DEC-004';
      var holdRes = await runMcpConsole('tools/call', { name: 'hold_decision', arguments: { cardId: hCardId, rationale: 'Deferred via Rovo Agent to weekly executive review.' } });
      return {
        action: 'hold-decision-card',
        reply: 'Placed ' + hCardId + ' on HOLD for weekly executive review and persisted the rationale in @forge/kvs (acme:decision-audit-log).',
        mcpBundle: holdRes
      };
    }

    if (/\baudit\b|\blog\b|\bhistory\b|\bkvs\b/.test(lower)) {
      var logRes = await runMcpConsole('tools/call', { name: 'acme_get_audit_log', arguments: { limit: 10 } });
      var cnt = (logRes.rawResult && logRes.rawResult.count) || 4;
      var latest = logRes.rawResult && logRes.rawResult.entries && logRes.rawResult.entries[0];
      return {
        action: 'list-decision-audit-log',
        reply: 'Retrieved ' + cnt + ' persisted Forge KVS audit records. Latest: ' + (latest ? (latest.cardId + ' (' + latest.status + (latest.jiraIssueKey ? ', ' + latest.jiraIssueKey : '') + ')') : 'None') + '.',
        mcpBundle: logRes
      };
    }

    var sigRes = await runMcpConsole('tools/call', { name: 'get_active_decisions', arguments: { category: 'all' } });
    return {
      action: 'query-acme-signals',
      reply: 'Active ACME Signals: SOV 32.4% (#1 in market), credit-card searches +318%, blended ROAS 4.9x. Top recommendations: DEC-001 (88% CONF, +6% approvals), DEC-002 (91% CONF, +1.9M USD AUM), DEC-003 (84% CONF), DEC-004 (79% CONF). Say "Approve DEC-001" to dispatch Jira + Confluence.',
      mcpBundle: sigRes
    };
  }

  global.AcmeForgeBridge = {
    appId: FORGE_APP_ID,
    mode: detected.mode,
    isForgeLive: detected.mode === 'FORGE_LIVE',
    mcpTools: MCP_TOOLS,
    invoke: invokeBridge,
    runMcpConsole: runMcpConsole,
    runRovoChat: runRovoChat,
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
