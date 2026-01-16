# Governance, Compliance & Enforcement (Internal)

Objective: create enforceable, automated governance for ecosystem participation with **non-ambiguous rules** and **progressive enforcement**.

## 1) Formal rules (explicit)

### Content standards (enforced in code)

Public + partner outputs must meet minimum quality gates (examples):
- no suppressed deals
- no expired deals
- valid price fields
- product not blocked
- product title non-empty

### Monetization limits (non-negotiable)

Partner monetization config caps:
- `platformFeeBps` **≤ 3000** (≤ 30%)
- `usageCentsPer1000Clicks` **≤ 500** ($5.00 / 1,000 value-delivery clicks)

### Usage policies (non-negotiable)

- per-partner rate limiting enforced on every endpoint
- per-partner `maxLimit` enforced (requests are clamped; over-asks recorded)
- no raw user data ever emitted

## 2) Enforcement tools (automated)

### Monitoring

Governance signals are recorded automatically into `SystemAlert` with messages prefixed by:

`gov:partner=<key> rule=<rule> action=<action> details=<...>`

No IP/user-agent is stored in governance alerts.

### Violation alerts

Alerts are deduped per window to prevent noise.

### Progressive enforcement actions

Enforcement is derived from current open governance alerts for a partner:
- **warn**: 2+ open violations (no behavior change)
- **throttle**: 5+ open violations (additional throttling limiter)
- **suspend**: 10+ open violations or 2+ critical (partner endpoints return 404)
- **terminate**: 15+ open violations or 3+ critical (partner endpoints return 404; action labeled terminate)

## 3) Escalation paths (deterministic)

Warnings → Throttling → Suspension → Termination are **computed**, not manually toggled, so enforcement is self-applying.

## 4) Reporting surfaces

- Admin: `/admin/governance` (partner enforcement state + recent governance alerts)
- Existing admin: `/admin/partners` and `/admin/monetization` for operational + economics context

