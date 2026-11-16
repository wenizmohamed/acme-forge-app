# ACME Decisions Layer & Command Center (Atlassian Codegeist 2026)

Enterprise Strategic Intelligence, Rovo Executive Decision Agent, Jira Epic Dispatcher, and Confluence Decision Governance built on **Atlassian Forge**.

- **Atlassian Forge App ID**: `ari:cloud:ecosystem::app/1ccdf603-166b-400f-b0d9-6f6dab65f91a`
- **Live Interactive Demo**: [https://wenizmohamed.github.io/acme-forge-app/](https://wenizmohamed.github.io/acme-forge-app/)
- **Demo Video**: [https://youtu.be/EGcZE_zgaHE](https://youtu.be/EGcZE_zgaHE)

## Forge Modules Included (`manifest.yml`)
1. `rovo:agent` (`acme-decisions-agent`) — ACME Executive Decisions Agent
2. `action` (`approve-decision-card`, `query-acme-signals`) — Rovo Actions for 1-click Jira & Confluence execution
3. `jira:globalPage` (`acme-command-center-page`) — Custom UI Command Center embedded in Jira
4. `confluence:macro` (`acme-executive-scorecard`) — Executive Scorecard embedded in Confluence
5. `function` (`approveDecisionCard`, `queryAcmeSignals`, `resolver`) — Node.js 20.x Forge backend functions
