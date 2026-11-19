/**
 * Authoritative ACME Decisions Layer catalog, market signals,
 * Teamwork Graph context descriptors, and MCP tool JSON Schemas.
 */

export const FORGE_APP_ID = 'ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a';

export const DECISION_CARDS = [
  {
    id: 'DEC-001',
    tag: 'BUDGET SHIFT',
    category: 'budget',
    tone: '#0F766E',
    confidence: 88,
    conf: '88%',
    title: 'Move 40K USD from display to search',
    body: 'Credit-card search intent is up 318% after the TV spot. Display is the weakest channel this week.',
    impact: '+6% approvals · ~310 cards',
    approveMsg: 'Approved, 40K USD shifted to search. Live in 20 min.',
    ownerTeam: 'Growth & Performance Media',
    jiraIssueType: 'Task',
    jiraPriority: 'High',
    labels: ['acme-decision', 'budget-shift', 'rovo-approved'],
    teamworkGraphGoals: ['goal:q3-cardholder-acquisition', 'project:paid-search-scale']
  },
  {
    id: 'DEC-002',
    tag: 'CREATIVE PUSH',
    category: 'creative',
    tone: '#B4690E',
    confidence: 91,
    conf: '91%',
    title: 'Push the Arabic CTV variant tonight',
    body: 'Arabic queries are the fastest-growing segment. The Arabic cut outperforms English by 2.3x on completion.',
    impact: '+1.9M USD projected AUM',
    approveMsg: 'Approved, Arabic CTV variant scheduled for tonight.',
    ownerTeam: 'Brand & Arabic Creative Studio',
    jiraIssueType: 'Task',
    jiraPriority: 'High',
    labels: ['acme-decision', 'creative-push', 'arabic-first'],
    teamworkGraphGoals: ['goal:arabic-market-leadership', 'project:ctv-prime-flight']
  },
  {
    id: 'DEC-003',
    tag: 'REGIONAL',
    category: 'regional',
    tone: '#17c964',
    confidence: 84,
    conf: '84%',
    title: 'Double Southbay radio through summer',
    body: 'Summer season traffic lifts branch visits +11%. Radio is Southbay\'s strongest channel by far.',
    impact: '+320 cardholders · MTD gap closed',
    approveMsg: 'Approved, Southbay radio doubled through August.',
    ownerTeam: 'Regional Marketing (Southbay)',
    jiraIssueType: 'Task',
    jiraPriority: 'Medium',
    labels: ['acme-decision', 'regional-growth', 'southbay'],
    teamworkGraphGoals: ['goal:southbay-mtd-1600', 'project:summer-radio-wave']
  },
  {
    id: 'DEC-004',
    tag: 'FIX',
    category: 'fix',
    tone: '#b98a12',
    confidence: 79,
    conf: '79%',
    title: 'Pause email journey, rebuild Arabic-first',
    body: 'Email ROAS is 2.1x vs 2.8x target. 86% of voice-agent calls are in Arabic, the journey is English-only.',
    impact: 'Save 18K USD / month',
    approveMsg: 'Approved, email paused. Arabic-first rebuild queued.',
    ownerTeam: 'Lifecycle CRM & Voice Ops',
    jiraIssueType: 'Task',
    jiraPriority: 'High',
    labels: ['acme-decision', 'lifecycle-fix', 'arabic-first'],
    teamworkGraphGoals: ['goal:crm-roas-2.8x', 'project:arabic-email-rebuild']
  }
];

export const SEED_AUDIT_LOG = [
  {
    id: 'AUD-SEED-01',
    dateLabel: 'JUL 14',
    timestamp: '2026-07-14T10:15:00.000Z',
    cardId: 'DEC-002',
    title: 'Pushed Arabic CTV variant after TV search spike',
    impact: '+318% searches',
    status: 'EXECUTED',
    actor: 'Executive Committee',
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
    actor: 'VP Growth',
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
    actor: 'Head of Customer Care',
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
    actor: 'Regional Director',
    jiraIssueKey: 'ACME-101',
    confluencePageId: '4021712',
    teamworkGraphEdges: ['ari:cloud:jira::issue/ACME-101', 'ari:cloud:confluence::page/4021712']
  }
];

export const MARKET_SIGNALS = {
  appId: FORGE_APP_ID,
  shareOfVoice: '32.4% (#1 in market, +3.8 pts vs Harbor Bank)',
  searchVelocity: '+318% ("acme credit card", 7d)',
  sentimentScore: '74 / 100 (+0.42 6h delta)',
  activeCampaigns: '8 channels (4.9x ROAS blended, 412K USD MTD)',
  approvedCardholdersMTD: 5280,
  approvedCardholdersTarget: 4200,
  costPerApprovedUSD: 19.85,
  approvalRatePct: 82,
  southbayCardholdersMTD: 1470,
  southbayTarget: 1600,
  arabicQuerySharePct: 64,
  voiceAgentCallsMTD: 12400
};

export const MCP_TOOLS = [
  {
    name: 'acme_query_signals',
    description: 'Query live ACME strategic market signals, KPI scorecards, and pending executive decision cards.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'budget', 'creative', 'regional', 'fix'],
          description: 'Optional decision category filter.'
        }
      }
    }
  },
  {
    name: 'acme_approve_decision',
    description: 'Approve a decision card: creates a Jira issue via REST API v3, publishes/appends a Confluence Decision Governance page via REST API v2, and persists an immutable audit record in Forge KVS.',
    inputSchema: {
      type: 'object',
      required: ['cardId'],
      properties: {
        cardId: { type: 'string', description: 'Decision card ID (e.g. DEC-001).' },
        projectKey: { type: 'string', description: 'Target Jira project key.' },
        spaceId: { type: 'string', description: 'Target Confluence space ID.' },
        decisionLogPageId: { type: 'string', description: 'Optional existing Confluence page ID to append to.' },
        rationale: { type: 'string', description: 'Executive rationale attached to Jira and Confluence.' }
      }
    }
  },
  {
    name: 'acme_hold_decision',
    description: 'Place an ACME decision card on hold for weekly executive review and log the rationale in Forge KVS.',
    inputSchema: {
      type: 'object',
      required: ['cardId'],
      properties: {
        cardId: { type: 'string', description: 'Decision card ID (e.g. DEC-001).' },
        rationale: { type: 'string', description: 'Reason for holding the recommendation.' }
      }
    }
  },
  {
    name: 'acme_get_audit_log',
    description: 'Retrieve the persisted Forge KVS Decision Audit Log with Jira issue keys, Confluence page IDs, and Teamwork Graph ARIs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 100, description: 'Maximum audit entries to return.' }
      }
    }
  }
];

export function findDecisionCard(cardId) {
  if (!cardId) return null;
  const normalized = String(cardId).trim().toLowerCase();
  return (
    DECISION_CARDS.find((c) => c.id.toLowerCase() === normalized) ||
    DECISION_CARDS.find((c) => c.title.toLowerCase() === normalized) ||
    null
  );
}
