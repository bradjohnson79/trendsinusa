# Succession & Change-of-Control Scenarios (Internal)

Objective: ensure the platform can outlive individual decisions and leadership changes.

## Scenario A — Ownership changes

### What must remain true
- stewardship charter remains binding (privacy, trust, no forks, steward-controlled governance)
- governance and monetization remain config-gated and reversible
- partner surfaces remain closed by default

### Transition checklist
- rotate all secrets:
  - partner tokens (env vars)
  - admin session secret
  - database credentials
  - AI keys
- verify kill switches:
  - partner enabled flags
  - scope lists
  - billing mode env (`ECOSYSTEM_BILLING_MODE`)
- export data room artifacts:
  - architecture, ops, governance, economics docs
  - exit-grade reports (if applicable)

## Scenario B — Leadership changes (operator continuity)

### What new leadership must learn first
- where configuration lives (`config/sites.json`, `config/partners.json`)
- how governance escalates (deterministic)
- how statements and signals are computed (aggregated)

### Minimum operating cadence
- daily: check ingestion freshness + alerts
- weekly: review partner concentration + governance state
- monthly: review economics assumptions + tier policy

## Scenario C — Strategic partnership pressure

Default posture:
- no bespoke forks
- no special data access beyond tier policy
- no exceptions to privacy or governance

Escalation:
- Stewardship Review (dual control) veto applies to any new scope or data surface

