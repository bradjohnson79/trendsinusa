# Long-Term Safeguards (Internal)

Objective: preserve platform integrity over time via explicit limits and veto powers.

## Dependency caps

Non-negotiable constraints:
- Prefer **standard library / platform primitives** over adding dependencies.
- New dependencies must be:
  - widely adopted
  - security-reviewed/maintained
  - pinned with lockfile
  - removable without rewriting core logic
- Avoid dependencies that:
  - require privileged network access unnecessarily
  - introduce tracking/analytics or data exfiltration risk
  - duplicate capabilities already present in the stack

## Partner concentration limits

Goal: avoid single-partner dependency risk.

Policy (default targets):
- No single partner should exceed **30%** of partner-attributed clicks over a rolling 30d window.
- If a partner exceeds **40%**: trigger escalation review + diversification plan.
- If a partner exceeds **50%**: enable protective throttles and renegotiation posture (no technical lock-in).

Implementation principle:
- use aggregated metrics only (no raw user data)
- enforce via governance controls + commercial policy (not ad-hoc exceptions)

## Strategic veto powers (dual control)

Stewardship Review (dual control) has explicit veto on:
- governance rule changes
- monetization model changes
- new partner scopes / data surfaces
- any change affecting privacy posture
- enabling “active” billing modes

All veto actions should be recorded as internal notes in the decision log (outside of code).

