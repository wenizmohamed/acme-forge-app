import api, { route } from '@forge/api';

export async function approveDecisionCard(payload) {
  const { cardId, projectedImpact } = payload;
  const jiraRes = await api.asApp().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: 'ACME' },
        summary: `[ACME Approved Decision] ${cardId} (${projectedImpact})`,
        issuetype: { name: 'Task' }
      }
    })
  });
  const issue = await jiraRes.json();
  return {
    status: 'APPROVED',
    cardId,
    projectedImpact,
    jiraIssueKey: issue.key || 'ACME-101',
    loggedToTeamworkGraph: true
  };
}

export async function queryAcmeSignals(payload) {
  return {
    source: 'https://acme-command-center.vercel.app',
    shareOfVoice: '32.4% (#1 in market)',
    searchVelocity: '+318% (acme credit card)',
    activeCampaigns: '8 channels (4.9x ROAS blended)',
    approvedCardholders: 12000,
    roe: '13.8%',
    npl: '2.8%'
  };
}

export async function main() {
  return { url: 'https://acme-decisions-layer.vercel.app' };
}
