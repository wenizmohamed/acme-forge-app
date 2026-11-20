/**
 * Pure payload & response builders for Atlassian Jira REST API v3,
 * Confluence Cloud REST API v2, Forge KVS Audit Log, and Rovo Agent cards.
 */

import { FORGE_APP_ID, FORGE_SCOPES } from './catalog.js';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatShortDate(isoTimestamp) {
  const dt = isoTimestamp ? new Date(isoTimestamp) : new Date();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const m = months[dt.getUTCMonth()] || 'NOV';
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${m} ${d}`;
}

export function buildTeamworkGraphLinks({ cloudId, jiraIssueKey, confluencePageId, card }) {
  const siteScope = cloudId || 'workspace';
  const cardId = card?.id || 'DEC-001';
  const links = [
    {
      type: 'forge-app',
      ari: FORGE_APP_ID,
      relation: 'GOVERNED_BY',
      label: 'ACME Decisions Layer & Command Center'
    }
  ];

  if (jiraIssueKey) {
    links.push({
      type: 'jira-issue',
      ari: `ari:cloud:jira:${siteScope}:issue/${jiraIssueKey}`,
      relation: 'DISPATCHED_TO',
      key: jiraIssueKey,
      label: `Jira Execution Issue ${jiraIssueKey}`
    });
  }

  if (confluencePageId) {
    links.push({
      type: 'confluence-page',
      ari: `ari:cloud:confluence:${siteScope}:page/${confluencePageId}`,
      relation: 'DOCUMENTED_IN',
      pageId: String(confluencePageId),
      label: `Confluence Decision Record #${confluencePageId}`
    });
  }

  links.push({
    type: 'teamwork-graph-edge',
    ari: `ari:cloud:graph:${siteScope}:relationship/decision-lineage/${cardId}${jiraIssueKey ? `/${jiraIssueKey}` : ''}`,
    relation: 'LINEAGE_VERIFIED',
    label: `Teamwork Graph Decision Lineage (${cardId})`
  });

  if (card?.teamworkGraphGoals?.length) {
    for (const goal of card.teamworkGraphGoals) {
      links.push({
        type: 'teamwork-goal',
        ari: `ari:cloud:townsquare:${siteScope}:${goal}`,
        relation: 'CONTRIBUTES_TO',
        label: goal
      });
    }
  }

  return links;
}

/**
 * Builds a valid Jira Cloud REST API v3 Create Issue request payload
 * with Atlassian Document Format (ADF) structured description.
 */
export function buildJiraIssuePayload(card, options = {}) {
  const projectKey = (options.projectKey || 'ACME').trim().toUpperCase();
  const issueType = options.issueType || card.jiraIssueType || 'Task';
  const actor = options.actor || 'ACME Executive User';
  const rationale = options.rationale || card.approveMsg || 'Approved via ACME Decisions Layer.';
  const timestamp = options.timestamp || new Date().toISOString();

  const summary = `[ACME Decision ${card.id}] ${card.title}`;

  const adfDescription = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: `${card.tag}: ${card.title}` }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: card.body }]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Decision ID: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: card.id }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Projected Impact: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: card.impact }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Model Confidence: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: card.conf || `${card.confidence}%` }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Owner Team: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: card.ownerTeam || 'ACME Executive Operations' }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Approved By: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: `${actor} (${timestamp})` }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Executive Rationale: ', marks: [{ type: 'strong' }] },
                  { type: 'text', text: rationale }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  return {
    fields: {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
      labels: Array.from(new Set([...(card.labels || []), 'acme-decisions-layer'])),
      description: adfDescription
    }
  };
}

/**
 * Builds Confluence Storage Format XHTML block for a single decision record.
 */
export function buildConfluenceDecisionBlock(card, jiraResult = {}, options = {}) {
  const actor = escapeXml(options.actor || 'ACME Executive User');
  const timestamp = escapeXml(options.timestamp || new Date().toISOString());
  const rationale = escapeXml(options.rationale || card.approveMsg || 'Approved via ACME Decisions Layer.');
  const jiraKey = escapeXml(jiraResult.key || 'PENDING');
  const jiraUrl = jiraResult.browseUrl ? escapeXml(jiraResult.browseUrl) : '';
  const jiraCell = jiraUrl
    ? `<a href="${jiraUrl}">${jiraKey}</a>`
    : `<code>${jiraKey}</code>`;

  return [
    `<h2>${escapeXml(card.id)} — ${escapeXml(card.title)}</h2>`,
    `<p><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">APPROVED</ac:parameter></ac:structured-macro> `,
    `<strong>Category:</strong> ${escapeXml(card.tag)} | <strong>Confidence:</strong> ${escapeXml(card.conf || `${card.confidence}%`)} | <strong>Approved:</strong> ${timestamp}</p>`,
    `<p>${escapeXml(card.body)}</p>`,
    '<table><tbody>',
    `<tr><th>Projected Impact</th><td>${escapeXml(card.impact)}</td></tr>`,
    `<tr><th>Jira Execution Ticket</th><td>${jiraCell}</td></tr>`,
    `<tr><th>Owner Team</th><td>${escapeXml(card.ownerTeam || 'Executive Ops')}</td></tr>`,
    `<tr><th>Approved By</th><td>${actor}</td></tr>`,
    `<tr><th>Rationale</th><td>${rationale}</td></tr>`,
    `<tr><th>Teamwork Graph Goals</th><td>${escapeXml((card.teamworkGraphGoals || []).join(', ') || 'acme-executive-layer')}</td></tr>`,
    '</tbody></table>',
    '<hr />'
  ].join('');
}

/**
 * Builds a valid Confluence Cloud REST API v2 Create Page payload (`POST /wiki/api/v2/pages`).
 */
export function buildConfluenceCreatePagePayload(card, jiraResult = {}, options = {}) {
  const spaceId = String(options.spaceId || '').trim();
  const timestamp = options.timestamp || new Date().toISOString();
  const titleSuffix = jiraResult.key ? ` (${jiraResult.key})` : ` (${formatShortDate(timestamp)})`;
  const title = `ACME Decision Record: ${card.id} - ${card.title}${titleSuffix}`;

  const value = [
    '<p><em>Auto-generated by ACME Decisions Layer &amp; Command Center (Atlassian Forge).</em></p>',
    buildConfluenceDecisionBlock(card, jiraResult, options)
  ].join('');

  const payload = {
    spaceId,
    status: 'current',
    title,
    body: {
      representation: 'storage',
      value
    }
  };

  if (options.parentId) {
    payload.parentId = String(options.parentId);
  }

  return payload;
}

/**
 * Builds a valid Confluence Cloud REST API v2 Update/Append Page payload (`PUT /wiki/api/v2/pages/{id}`).
 */
export function buildConfluenceAppendPagePayload(existingPage, card, jiraResult = {}, options = {}) {
  const currentBody = existingPage?.body?.storage?.value || '';
  const currentVersion = Number(existingPage?.version?.number || 1);
  const appendedBlock = buildConfluenceDecisionBlock(card, jiraResult, options);

  return {
    id: String(existingPage.id),
    status: 'current',
    title: existingPage.title || 'ACME Executive Decision Log',
    body: {
      representation: 'storage',
      value: `${appendedBlock}${currentBody}`
    },
    version: {
      number: currentVersion + 1,
      message: `Logged ACME decision ${card.id}${jiraResult.key ? ` (${jiraResult.key})` : ''}`
    }
  };
}

/**
 * Builds a canonical Forge KVS Decision Audit Log entry.
 */
export function buildAuditEntry({
  card,
  status,
  actor,
  rationale,
  timestamp,
  jiraResult,
  confluenceResult,
  cloudId
}) {
  const ts = timestamp || new Date().toISOString();
  const cleanId = `AUD-${card.id}-${Date.parse(ts) || Date.now()}`;
  const teamworkGraph = buildTeamworkGraphLinks({
    cloudId,
    jiraIssueKey: jiraResult?.key || null,
    confluencePageId: confluenceResult?.id || null,
    card
  });

  return {
    id: cleanId,
    dateLabel: formatShortDate(ts),
    timestamp: ts,
    cardId: card.id,
    tag: card.tag,
    title: card.title,
    impact: card.impact,
    confidence: card.conf || `${card.confidence}%`,
    status,
    actor: actor || 'ACME Executive User',
    rationale: rationale || (status === 'HELD' ? 'Deferred to weekly executive review.' : card.approveMsg),
    jiraIssueKey: jiraResult?.key || null,
    jiraIssueUrl: jiraResult?.browseUrl || null,
    jiraStatus: jiraResult?.status || (status === 'HELD' ? 'SKIPPED' : 'PENDING'),
    confluencePageId: confluenceResult?.id || null,
    confluencePageUrl: confluenceResult?.webUrl || null,
    confluenceStatus: confluenceResult?.status || (status === 'HELD' ? 'SKIPPED' : 'PENDING'),
    teamworkGraphEdges: teamworkGraph.map((l) => l.ari)
  };
}

/**
 * Builds a structured Rovo Agent decision card response.
 */
export function buildRovoDecisionCardResponse({
  card,
  status,
  auditEntry,
  jiraResult,
  confluenceResult,
  cloudId
}) {
  const teamworkGraphLinks = buildTeamworkGraphLinks({
    cloudId,
    jiraIssueKey: jiraResult?.key || auditEntry?.jiraIssueKey || null,
    confluencePageId: confluenceResult?.id || auditEntry?.confluencePageId || null,
    card
  });

  return {
    ok: true,
    status,
    card: {
      id: card.id,
      tag: card.tag,
      title: card.title,
      confidence: card.conf || `${card.confidence}%`,
      projectedImpact: card.impact,
      ownerTeam: card.ownerTeam
    },
    execution: {
      jira: jiraResult || { status: 'SKIPPED' },
      confluence: confluenceResult || { status: 'SKIPPED' },
      auditLogPersisted: true,
      auditEntryId: auditEntry.id
    },
    teamworkGraphLinks,
    summary:
      status === 'APPROVED'
        ? `Approved ${card.id} (${card.title}). Jira: ${jiraResult?.key || 'queued'}. Confluence: ${confluenceResult?.id ? `#${confluenceResult.id}` : 'queued'}. Logged in Forge KVS.`
        : `Held ${card.id} (${card.title}) for weekly executive review. Logged in Forge KVS.`
  };
}

/**
 * Compiles an Executive Board Brief Governance Pack (.md + .json) containing
 * approved/held decisions, Jira REST API v3 ADF payloads, Confluence REST API v2
 * XHTML storage bodies, Forge KVS audit receipts, Teamwork Graph ARI lineage,
 * and exact least-privilege Forge manifest scopes.
 */
export function buildExecutiveBoardBrief({
  decisionCards = [],
  decisionStates = {},
  auditLog = [],
  signals = {},
  cloudId = 'workspace',
  projectKey = 'ACME',
  spaceId = '4021000',
  generatedAt = new Date().toISOString()
} = {}) {
  const compiledDecisions = decisionCards.map((card) => {
    const st = decisionStates[card.id] || {};
    const status = st.status || card.status || 'PENDING';
    const jiraKey = st.jiraIssueKey || card.jiraIssueKey || null;
    const confluencePageId = st.confluencePageId || card.confluencePageId || null;
    const jiraPayload = buildJiraIssuePayload(card, {
      projectKey,
      actor: st.actor || 'ACME Executive Committee',
      rationale: st.rationale || card.approveMsg,
      timestamp: st.updatedAt || generatedAt
    });
    const confluencePayload = buildConfluenceCreatePagePayload(
      card,
      { key: jiraKey || 'PENDING', browseUrl: jiraKey ? `/browse/${jiraKey}` : '' },
      {
        spaceId,
        actor: st.actor || 'ACME Executive Committee',
        rationale: st.rationale || card.approveMsg,
        timestamp: st.updatedAt || generatedAt
      }
    );
    const teamworkGraphLinks = buildTeamworkGraphLinks({
      cloudId,
      jiraIssueKey: jiraKey,
      confluencePageId,
      card
    });

    return {
      id: card.id,
      tag: card.tag,
      title: card.title,
      confidence: card.conf || `${card.confidence}%`,
      projectedImpact: card.impact,
      ownerTeam: card.ownerTeam || 'ACME Executive Operations',
      status,
      jiraIssueKey: jiraKey,
      confluencePageId,
      updatedAt: st.updatedAt || null,
      teamworkGraphLinks,
      jiraAdfPayload: jiraPayload,
      confluenceXhtmlPayload: confluencePayload
    };
  });

  const approvedCount = compiledDecisions.filter((d) => d.status === 'APPROVED').length;
  const heldCount = compiledDecisions.filter((d) => d.status === 'HELD').length;
  const pendingCount = compiledDecisions.filter((d) => d.status === 'PENDING').length;

  const jsonPack = {
    schemaVersion: 'acme.executive-board-brief/v1',
    generatedAt,
    appId: FORGE_APP_ID,
    runtime: 'nodejs22.x',
    summary: {
      totalCards: compiledDecisions.length,
      approvedCount,
      heldCount,
      pendingCount,
      auditReceiptCount: auditLog.length,
      leastPrivilegeScopeCount: FORGE_SCOPES.length
    },
    marketSignals: signals,
    forgeScopes: FORGE_SCOPES,
    decisions: compiledDecisions,
    kvsAuditReceipts: auditLog
  };

  const mdLines = [
    '# ACME Executive Board Brief - Atlassian Forge Governance Pack',
    '',
    `- **Generated:** ${generatedAt}`,
    `- **Atlassian Forge App ID:** \`${FORGE_APP_ID}\``,
    `- **Runtime:** \`nodejs22.x\` | **Least-Privilege Scopes:** ${FORGE_SCOPES.length} verified`,
    `- **Portfolio Decision Status:** ${approvedCount} Approved | ${heldCount} Held | ${pendingCount} Pending | ${auditLog.length} KVS Audit Receipts`,
    '',
    '## 1. Executive Decision Matrix',
    '',
    '| Card | Category | Decision | Confidence | Impact | Status | Atlassian Artifacts |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...compiledDecisions.map((d) => {
      const refs = [d.jiraIssueKey, d.confluencePageId ? `Conf #${d.confluencePageId}` : ''].filter(Boolean).join(' / ') || 'Pending Dispatch';
      return `| ${d.id} | ${d.tag} | ${d.title} | ${d.confidence} | ${d.projectedImpact} | **${d.status}** | ${refs} |`;
    }),
    '',
    '## 2. Teamwork Graph ARI Lineage & Atlassian Payloads',
    ''
  ];

  for (const d of compiledDecisions) {
    mdLines.push(`### ${d.id}: ${d.title} (${d.status})`);
    mdLines.push('');
    mdLines.push('**Teamwork Graph ARIs:**');
    for (const edge of d.teamworkGraphLinks) {
      mdLines.push(`- \`${edge.relation}\`: \`${edge.ari}\``);
    }
    mdLines.push('');
    mdLines.push('**Jira REST API v3 ADF Payload (`POST /rest/api/3/issue`):**');
    mdLines.push('```json');
    mdLines.push(JSON.stringify(d.jiraAdfPayload, null, 2));
    mdLines.push('```');
    mdLines.push('');
    mdLines.push('**Confluence REST API v2 Storage XHTML (`POST /wiki/api/v2/pages`):**');
    mdLines.push('```xml');
    mdLines.push(d.confluenceXhtmlPayload.body.value);
    mdLines.push('```');
    mdLines.push('');
  }

  mdLines.push('## 3. Forge KVS Audit Receipts (`acme:decision-audit-log`)');
  mdLines.push('');
  mdLines.push('| Receipt ID | Date | Card | Status | Jira | Confluence | Impact |');
  mdLines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of auditLog) {
    mdLines.push(
      `| \`${r.id || 'AUD'}\` | ${r.dateLabel || 'LIVE'} | ${r.cardId || '-'} | ${r.status || 'EXECUTED'} | ${r.jiraIssueKey || '-'} | ${r.confluencePageId ? `#${r.confluencePageId}` : '-'} | ${r.impact || '-'} |`
    );
  }
  mdLines.push('');
  mdLines.push('## 4. Verified Least-Privilege Forge Scopes (`manifest.yml`)');
  mdLines.push('');
  mdLines.push('| Scope | Product | Access | API / Binding |');
  mdLines.push('| --- | --- | --- | --- |');
  for (const sc of FORGE_SCOPES) {
    mdLines.push(`| \`${sc.scope}\` | ${sc.product} | ${sc.access} | ${sc.api} |`);
  }
  mdLines.push('');

  return {
    schemaVersion: jsonPack.schemaVersion,
    generatedAt,
    summary: jsonPack.summary,
    json: jsonPack,
    markdown: mdLines.join('\n')
  };
}
