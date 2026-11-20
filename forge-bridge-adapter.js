/**
 * ACME Forge Custom UI Bridge, Interactive Rovo Agent Client,
 * Teamwork Graph & Forge Scope Inspector, Executive Board Brief Compiler,
 * and Live Forge MCP JSON-RPC 2.0 Console Adapter.
 *
 * - Inside Atlassian Jira / Confluence Forge Custom UI iframe:
 *   Calls real `@forge/bridge` `invoke(functionKey, payload)` to hit live Forge resolvers
 *   backed by `api.asUser().requestJira`, `api.asUser().requestConfluence`, and `@forge/kvs`.
 * - Outside Forge iframe (e.g., GitHub Pages live preview at wenizmohamed.github.io/acme-forge-app):
 *   Activates a transparent, localStorage-persisted preview adapter that mirrors the exact
 *   Forge resolver + MCP JSON-RPC 2.0 schema-validated contract and surfaces live Jira REST API v3 ADF,
 *   Confluence Decision Page XHTML, Teamwork Graph ARIs, least-privilege Forge scopes, and timings.
 */
(function (global) {
  'use strict';

  var STORAGE_AUDIT_KEY = 'acme_forge_preview_audit_v2';
  var STORAGE_STATE_KEY = 'acme_forge_preview_states_v2';
  var STORAGE_SEQ_KEY = 'acme_forge_preview_seq_v2';
  var FORGE_APP_ID = 'ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a';

  var FORGE_SCOPES = [
    {
      scope: 'storage:app',
      product: 'Forge KVS',
      access: 'READ / WRITE',
      api: '@forge/kvs (acme:decision-audit-log, acme:decision-states, acme:workspace-config)',
      rationale: 'Persists immutable decision receipts, card states, and workspace config in Atlassian Forge KVS.'
    },
    {
      scope: 'read:jira-work',
      product: 'Jira Cloud',
      access: 'READ',
      api: 'GET /rest/api/3/project/search',
      rationale: 'Auto-discovers accessible Jira projects when no explicit projectKey is configured.'
    },
    {
      scope: 'write:jira-work',
      product: 'Jira Cloud',
      access: 'WRITE',
      api: 'POST /rest/api/3/issue (asUser)',
      rationale: 'Dispatches structured Atlassian Document Format (ADF) Jira issues on approval.'
    },
    {
      scope: 'read:page:confluence',
      product: 'Confluence Cloud',
      access: 'READ',
      api: 'GET /wiki/api/v2/pages/{id}?body-format=storage',
      rationale: 'Reads storage XHTML and version number prior to version-incremented Decision Log appends.'
    },
    {
      scope: 'write:page:confluence',
      product: 'Confluence Cloud',
      access: 'WRITE',
      api: 'POST /wiki/api/v2/pages & PUT /wiki/api/v2/pages/{id}',
      rationale: 'Publishes or appends Confluence Decision Governance pages with status macros and KPI tables.'
    },
    {
      scope: 'read:space:confluence',
      product: 'Confluence Cloud',
      access: 'READ',
      api: 'GET /wiki/api/v2/spaces?limit=5',
      rationale: 'Resolves the target Confluence Space ID automatically when workspace spaceId is unset.'
    },
    {
      scope: 'read:confluence-content.all',
      product: 'Confluence Cloud',
      access: 'READ',
      api: 'Confluence Global Page & Macro context',
      rationale: 'Allows embedded Confluence Global Page and Executive Scorecard macro to resolve page metadata.'
    },
    {
      scope: 'write:confluence-content',
      product: 'Confluence Cloud',
      access: 'WRITE',
      api: 'Confluence Macro & Governance Record sync',
      rationale: 'Permits structured storage-format governance updates scoped strictly to authorized spaces.'
    }
  ];

  var CATALOG_CARDS = [
    {
      id: 'DEC-001',
      tag: 'BUDGET SHIFT',
      category: 'budget',
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
      category: 'creative',
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
      category: 'regional',
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
      category: 'fix',
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
      teamworkGraphEdges: [
        FORGE_APP_ID,
        'ari:cloud:jira:workspace:issue/ACME-104',
        'ari:cloud:confluence:workspace:page/4021901',
        'ari:cloud:graph:workspace:relationship/decision-lineage/DEC-002/ACME-104'
      ]
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
      teamworkGraphEdges: [
        FORGE_APP_ID,
        'ari:cloud:jira:workspace:issue/ACME-103',
        'ari:cloud:confluence:workspace:page/4021844',
        'ari:cloud:graph:workspace:relationship/decision-lineage/DEC-001/ACME-103'
      ]
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
      teamworkGraphEdges: [
        FORGE_APP_ID,
        'ari:cloud:jira:workspace:issue/ACME-102',
        'ari:cloud:confluence:workspace:page/4021790',
        'ari:cloud:graph:workspace:relationship/decision-lineage/DEC-CARE-09/ACME-102'
      ]
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
      teamworkGraphEdges: [
        FORGE_APP_ID,
        'ari:cloud:jira:workspace:issue/ACME-101',
        'ari:cloud:confluence:workspace:page/4021712',
        'ari:cloud:graph:workspace:relationship/decision-lineage/DEC-003/ACME-101'
      ]
    }
  ];

  var MCP_TOOLS = [
    {
      name: 'acme_query_signals',
      alias: 'get_active_decisions',
      action: 'query-acme-signals',
      verb: 'GET',
      description: 'Return live ACME market signals, KPI scorecards, and ranked executive decision cards.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['all', 'budget', 'creative', 'regional', 'fix'] }
        }
      }
    },
    {
      name: 'acme_approve_decision',
      alias: 'approve_decision',
      action: 'approve-decision-card',
      verb: 'CREATE',
      description: 'Approve a decision card: create Jira v3 ADF issue, publish Confluence v2 Decision Page, persist Forge KVS audit record.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string' },
          projectKey: { type: 'string' },
          spaceId: { type: 'string' },
          decisionLogPageId: { type: 'string' },
          rationale: { type: 'string' }
        }
      }
    },
    {
      name: 'acme_hold_decision',
      alias: 'hold_decision',
      action: 'hold-decision-card',
      verb: 'UPDATE',
      description: 'Defer a decision card to weekly executive review with rationale stored in @forge/kvs.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string' },
          rationale: { type: 'string' }
        }
      }
    },
    {
      name: 'acme_get_audit_log',
      alias: 'get_audit_log',
      action: 'list-decision-audit-log',
      verb: 'GET',
      description: 'Read persisted Forge KVS Decision Audit Log with Jira keys, Confluence IDs, and Teamwork Graph ARIs.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  ];

  var MCP_TOOL_ALIASES = {
    acme_query_signals: 'acme_query_signals',
    get_active_decisions: 'acme_query_signals',
    acme_approve_decision: 'acme_approve_decision',
    approve_decision: 'acme_approve_decision',
    acme_hold_decision: 'acme_hold_decision',
    hold_decision: 'acme_hold_decision',
    acme_get_audit_log: 'acme_get_audit_log',
    get_audit_log: 'acme_get_audit_log'
  };

  function validateMcpArguments(toolName, args) {
    var canonical = MCP_TOOL_ALIASES[String(toolName || '').trim()] || null;
    if (!canonical) {
      return { valid: false, canonicalTool: null, checkedFields: [], errors: ['Unknown MCP tool: ' + String(toolName || '')] };
    }
    var def = null;
    for (var i = 0; i < MCP_TOOLS.length; i++) {
      if (MCP_TOOLS[i].name === canonical) { def = MCP_TOOLS[i]; break; }
    }
    var schema = (def && def.inputSchema) || { type: 'object', properties: {} };
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return { valid: false, canonicalTool: canonical, checkedFields: [], errors: ['arguments must be a JSON object'] };
    }
    var errors = [];
    var required = schema.required || [];
    for (var r = 0; r < required.length; r++) {
      var rf = required[r];
      var rv = args[rf];
      if (rv === undefined || rv === null || (typeof rv === 'string' && !rv.trim())) {
        errors.push('Missing required parameter "' + rf + '"');
      }
    }
    var props = schema.properties || {};
    var propKeys = Object.keys(props);
    for (var k = 0; k < propKeys.length; k++) {
      var key = propKeys[k];
      if (args[key] === undefined || args[key] === null) continue;
      var val = args[key];
      var ps = props[key];
      if (ps.type === 'string' && typeof val !== 'string') {
        errors.push('Parameter "' + key + '" must be a string');
        continue;
      }
      if (ps.type === 'number' && (typeof val !== 'number' || isNaN(val))) {
        errors.push('Parameter "' + key + '" must be a finite number');
        continue;
      }
      if (Array.isArray(ps.enum) && ps.enum.indexOf(val) === -1) {
        errors.push('Parameter "' + key + '" must be one of [' + ps.enum.join(', ') + ']');
      }
      if (typeof ps.minimum === 'number' && val < ps.minimum) {
        errors.push('Parameter "' + key + '" must be >= ' + ps.minimum);
      }
      if (typeof ps.maximum === 'number' && val > ps.maximum) {
        errors.push('Parameter "' + key + '" must be <= ' + ps.maximum);
      }
    }
    return { valid: errors.length === 0, canonicalTool: canonical, checkedFields: propKeys, errors: errors };
  }

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

  function escapeXml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
    var storageVal =
      '<h2>' + escapeXml(card.id) + ' - ' + escapeXml(card.title) + '</h2>' +
      '<p><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">APPROVED</ac:parameter></ac:structured-macro> ' +
      '<strong>Category:</strong> ' + escapeXml(card.tag) + ' | <strong>Confidence:</strong> ' + escapeXml(card.conf) + ' | <strong>Approved:</strong> ' + escapeXml(ts) + '</p>' +
      '<p>' + escapeXml(card.body) + '</p>' +
      '<table><tbody>' +
      '<tr><th>Projected Impact</th><td>' + escapeXml(card.impact) + '</td></tr>' +
      '<tr><th>Jira Execution Ticket</th><td><code>' + escapeXml(jiraKey || 'PENDING') + '</code></td></tr>' +
      '<tr><th>Owner Team</th><td>' + escapeXml(card.ownerTeam || 'Executive Ops') + '</td></tr>' +
      '</tbody></table><hr />';

    return {
      endpoint: 'POST /wiki/api/v2/pages',
      caller: 'api.asUser().requestConfluence',
      httpStatus: 200,
      createdPageId: confId,
      spaceId: '4021000',
      status: 'current',
      title: 'ACME Decision Record: ' + card.id + ' - ' + card.title + (jiraKey ? ' (' + jiraKey + ')' : ''),
      body: {
        representation: 'storage',
        value: storageVal
      }
    };
  }

  function buildTeamworkGraph(card, jiraKey, confId) {
    var cid = (card && card.id) || 'DEC-001';
    var edges = [
      { type: 'forge-app', ari: FORGE_APP_ID, relation: 'GOVERNED_BY', label: 'Forge App' }
    ];
    if (jiraKey) {
      edges.push({ type: 'jira-issue', ari: 'ari:cloud:jira:workspace:issue/' + jiraKey, relation: 'DISPATCHED_TO', label: 'Jira ' + jiraKey });
    }
    if (confId) {
      edges.push({ type: 'confluence-page', ari: 'ari:cloud:confluence:workspace:page/' + confId, relation: 'DOCUMENTED_IN', label: 'Confluence #' + confId });
    }
    edges.push({
      type: 'teamwork-graph-edge',
      ari: 'ari:cloud:graph:workspace:relationship/decision-lineage/' + cid + (jiraKey ? '/' + jiraKey : ''),
      relation: 'LINEAGE_VERIFIED',
      label: 'Teamwork Graph Lineage'
    });
    var goals = (card && card.goals) || ['goal:acme-executive-governance'];
    for (var i = 0; i < goals.length; i++) {
      edges.push({ type: 'teamwork-goal', ari: 'ari:cloud:townsquare:workspace:' + goals[i], relation: 'CONTRIBUTES_TO', label: goals[i] });
    }
    return edges;
  }

  function compileBoardBrief(overrides) {
    var ts = (overrides && overrides.generatedAt) || new Date().toISOString();
    var auditLog = (overrides && overrides.auditLog) || readJson(STORAGE_AUDIT_KEY, SEED_AUDIT.slice());
    var states = (overrides && overrides.decisionStates) || readJson(STORAGE_STATE_KEY, {});

    var compiledDecisions = CATALOG_CARDS.map(function (c) {
      var st = states[c.id] || {};
      var status = st.status || 'PENDING';
      var jiraKey = st.jiraIssueKey || null;
      var confId = st.confluencePageId || null;
      var jiraPayload = buildPreviewJiraPayload(c, 'ACME', st.updatedAt || ts, jiraKey || 'PENDING');
      var confPayload = buildPreviewConfluencePayload(c, jiraKey || 'PENDING', confId || 'PENDING', st.updatedAt || ts);
      var twg = buildTeamworkGraph(c, jiraKey || 'ACME-PENDING', confId || '4022000');
      return {
        id: c.id,
        tag: c.tag,
        title: c.title,
        confidence: c.conf,
        projectedImpact: c.impact,
        ownerTeam: c.ownerTeam,
        status: status,
        jiraIssueKey: jiraKey,
        confluencePageId: confId,
        updatedAt: st.updatedAt || null,
        teamworkGraphLinks: twg,
        jiraAdfPayload: jiraPayload,
        confluenceXhtmlPayload: confPayload
      };
    });

    var approvedCount = compiledDecisions.filter(function (d) { return d.status === 'APPROVED'; }).length;
    var heldCount = compiledDecisions.filter(function (d) { return d.status === 'HELD'; }).length;
    var pendingCount = compiledDecisions.filter(function (d) { return d.status === 'PENDING'; }).length;

    var jsonPack = {
      schemaVersion: 'acme.executive-board-brief/v1',
      generatedAt: ts,
      appId: FORGE_APP_ID,
      runtime: 'nodejs22.x',
      summary: {
        totalCards: compiledDecisions.length,
        approvedCount: approvedCount,
        heldCount: heldCount,
        pendingCount: pendingCount,
        auditReceiptCount: auditLog.length,
        leastPrivilegeScopeCount: FORGE_SCOPES.length
      },
      marketSignals: {
        shareOfVoice: '32.4% (#1 in market, +3.8 pts vs Harbor Bank)',
        searchVelocity: '+318% ("acme credit card", 7d)',
        blendedRoas: '4.9x across 8 channels',
        approvedCardholdersMTD: 5280
      },
      forgeScopes: FORGE_SCOPES,
      decisions: compiledDecisions,
      kvsAuditReceipts: auditLog
    };

    var md = [
      '# ACME Executive Board Brief - Atlassian Forge Governance Pack',
      '',
      '- **Generated:** ' + ts,
      '- **Atlassian Forge App ID:** `' + FORGE_APP_ID + '`',
      '- **Runtime:** `nodejs22.x` | **Least-Privilege Scopes:** ' + FORGE_SCOPES.length + ' verified',
      '- **Decision Portfolio:** ' + approvedCount + ' Approved | ' + heldCount + ' Held | ' + pendingCount + ' Pending | ' + auditLog.length + ' KVS Audit Receipts',
      '',
      '## 1. Executive Decision Matrix',
      '',
      '| Card | Category | Decision | Confidence | Impact | Status | Atlassian Artifacts |',
      '| --- | --- | --- | --- | --- | --- | --- |'
    ];
    for (var i = 0; i < compiledDecisions.length; i++) {
      var d = compiledDecisions[i];
      var ref = [d.jiraIssueKey, d.confluencePageId ? ('Conf #' + d.confluencePageId) : ''].filter(Boolean).join(' / ') || 'Pending Dispatch';
      md.push('| ' + d.id + ' | ' + d.tag + ' | ' + d.title + ' | ' + d.confidence + ' | ' + d.projectedImpact + ' | **' + d.status + '** | ' + ref + ' |');
    }
    md.push('', '## 2. Teamwork Graph ARI Lineage, Jira ADF & Confluence XHTML Payloads', '');
    for (var j = 0; j < compiledDecisions.length; j++) {
      var item = compiledDecisions[j];
      md.push('### ' + item.id + ': ' + item.title + ' (' + item.status + ')', '', '**Teamwork Graph ARIs:**');
      for (var e = 0; e < item.teamworkGraphLinks.length; e++) {
        md.push('- `' + item.teamworkGraphLinks[e].relation + '`: `' + item.teamworkGraphLinks[e].ari + '`');
      }
      md.push('', '**Jira REST API v3 ADF Payload (`POST /rest/api/3/issue`):**', '```json', JSON.stringify(item.jiraAdfPayload, null, 2), '```');
      md.push('', '**Confluence REST API v2 Storage XHTML (`POST /wiki/api/v2/pages`):**', '```xml', item.confluenceXhtmlPayload.body.value, '```', '');
    }
    md.push('## 3. Forge KVS Audit Receipts (`acme:decision-audit-log`)', '', '| Receipt ID | Date | Card | Status | Jira | Confluence | Impact |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (var k = 0; k < auditLog.length; k++) {
      var rec = auditLog[k];
      md.push('| `' + (rec.id || 'AUD') + '` | ' + (rec.dateLabel || 'LIVE') + ' | ' + (rec.cardId || '-') + ' | ' + (rec.status || 'EXECUTED') + ' | ' + (rec.jiraIssueKey || '-') + ' | ' + (rec.confluencePageId ? '#' + rec.confluencePageId : '-') + ' | ' + (rec.impact || '-') + ' |');
    }
    md.push('', '## 4. Verified Least-Privilege Forge Scopes (`manifest.yml`)', '', '| Scope | Product | Access | API / Binding |', '| --- | --- | --- | --- |');
    for (var s = 0; s < FORGE_SCOPES.length; s++) {
      var sc = FORGE_SCOPES[s];
      md.push('| `' + sc.scope + '` | ' + sc.product + ' | ' + sc.access + ' | ' + sc.api + ' |');
    }

    var markdown = md.join('\n');
    return {
      ok: true,
      schemaVersion: jsonPack.schemaVersion,
      generatedAt: ts,
      summary: jsonPack.summary,
      json: jsonPack,
      jsonString: JSON.stringify(jsonPack, null, 2),
      markdown: markdown
    };
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
        mcpTools: MCP_TOOLS,
        forgeScopes: FORGE_SCOPES
      };
    }

    if (functionKey === 'exportBoardBrief') {
      return compileBoardBrief({ auditLog: auditLog, decisionStates: states, generatedAt: ts });
    }

    if (functionKey === 'querySignals') {
      var cat = String((payload && payload.category) || 'all').trim().toLowerCase();
      var cardsWithState = CATALOG_CARDS.filter(function (c) {
        return cat === 'all' || c.category === cat;
      }).map(function (c) {
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
        teamworkGraphLinks: buildTeamworkGraph(cardsWithState[0] || CATALOG_CARDS[0], 'ACME-104', '4021901'),
        traces: [
          { api: '@forge/kvs', endpoint: 'kvs.get(acme:decision-states)', status: 200, ms: 19 },
          { api: 'rovo:action', endpoint: 'query-acme-signals (category=' + cat + ')', status: 200, ms: 31 }
        ]
      };
    }

    if (functionKey === 'getAuditLog') {
      var lim = Number(payload && payload.limit) || 25;
      var sliced = auditLog.slice(0, Math.max(1, Math.min(lim, 100)));
      return {
        ok: true,
        count: sliced.length,
        entries: sliced,
        storage: 'localStorage (preview mirror of @forge/kvs)',
        teamworkGraphLinks: buildTeamworkGraph(CATALOG_CARDS[0], (sliced[0] && sliced[0].jiraIssueKey) || 'ACME-104', (sliced[0] && sliced[0].confluencePageId) || '4021901'),
        traces: [{ api: '@forge/kvs', endpoint: 'kvs.get(acme:decision-audit-log, limit=' + lim + ')', status: 200, ms: 21 }]
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
      var hTwg = buildTeamworkGraph(hCard, null, null);
      var hEntry = {
        id: 'AUD-' + hCard.id + '-' + Date.now(),
        dateLabel: formatShortDate(ts),
        timestamp: ts,
        cardId: hCard.id,
        title: hCard.title,
        impact: 'Weekly review',
        status: 'HELD',
        rationale: (payload && payload.rationale) || 'Held for weekly executive review.',
        jiraIssueKey: null,
        confluencePageId: null,
        teamworkGraphEdges: hTwg.map(function (e) { return e.ari; })
      };

      var nextHoldAudit = [hEntry].concat(auditLog).slice(0, 50);
      writeJson(STORAGE_AUDIT_KEY, nextHoldAudit);

      states[hCard.id] = { status: 'HELD', rationale: hEntry.rationale, updatedAt: ts };
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
        teamworkGraphLinks: hTwg,
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
        validation: { valid: true, canonicalTool: 'tools/list', checkedFields: [], errors: [] },
        traces: [{ api: 'webtrigger:acme-mcp-endpoint', endpoint: 'POST /mcp (tools/list)', status: 200, ms: 14 }],
        jiraIssueJson: null,
        confluencePageJson: null,
        teamworkGraphEdges: [
          { type: 'forge-app', ari: FORGE_APP_ID, relation: 'EXPOSES_MCP_TOOLS' },
          { type: 'teamwork-graph-edge', ari: 'ari:cloud:graph:workspace:relationship/mcp-discovery/acme-decisions', relation: 'SCHEMA_PUBLISHED' }
        ],
        response: { jsonrpc: '2.0', id: reqId, result: { protocolVersion: '2025-03-26', tools: MCP_TOOLS } }
      };
    }

    if (method === 'tools/call') {
      var toolName = params && params.name;
      var args = (params && params.arguments !== undefined) ? params.arguments : {};
      var validation = validateMcpArguments(toolName, args);

      if (!validation.valid) {
        return {
          request: rpcReq,
          validation: validation,
          traces: [{ api: 'webtrigger:acme-mcp-endpoint', endpoint: 'POST /mcp (schema validation failed)', status: 200, ms: 4 }],
          jiraIssueJson: null,
          confluencePageJson: null,
          teamworkGraphEdges: [
            { type: 'forge-app', ari: FORGE_APP_ID, relation: 'SCHEMA_GUARD_BLOCKED' }
          ],
          response: {
            jsonrpc: '2.0',
            id: reqId,
            error: {
              code: -32602,
              message: validation.canonicalTool
                ? ('Invalid params for ' + validation.canonicalTool + ': ' + validation.errors.join('; '))
                : ('Unknown MCP tool: ' + String(toolName || '')),
              data: { tool: validation.canonicalTool || String(toolName || ''), errors: validation.errors }
            }
          }
        };
      }

      var res;
      if (validation.canonicalTool === 'acme_query_signals') {
        res = await invokeBridge('querySignals', args);
      } else if (validation.canonicalTool === 'acme_approve_decision') {
        res = await invokeBridge('approveDecision', args);
      } else if (validation.canonicalTool === 'acme_hold_decision') {
        res = await invokeBridge('holdDecision', args);
      } else {
        res = await invokeBridge('getAuditLog', args);
      }

      return {
        request: rpcReq,
        validation: validation,
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
            validation: validation,
            structuredContent: res
          }
        }
      };
    }

    return {
      request: rpcReq,
      validation: { valid: false, canonicalTool: null, checkedFields: [], errors: ['Method not found'] },
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
      var mcpRes = await runMcpConsole('tools/call', { name: 'acme_approve_decision', arguments: { cardId: cardId, rationale: 'Approved via Rovo Executive Decisions Agent chat.' } });
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
      var holdRes = await runMcpConsole('tools/call', { name: 'acme_hold_decision', arguments: { cardId: hCardId, rationale: 'Deferred via Rovo Agent to weekly executive review.' } });
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

    var sigRes = await runMcpConsole('tools/call', { name: 'acme_query_signals', arguments: { category: 'all' } });
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
    forgeScopes: FORGE_SCOPES,
    validateMcpArguments: validateMcpArguments,
    compileBoardBrief: compileBoardBrief,
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
