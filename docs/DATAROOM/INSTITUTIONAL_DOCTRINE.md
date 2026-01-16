# Institutional Doctrine (Internal)

Objective: replace tribal knowledge with durable doctrine so the platform remains operable, governable, and survivable long-term.

## Design principles (how we build)

- **One core engine**: no forks; white-label is config-driven.
- **Privacy by construction**: raw user data is never exposed externally; aggregates only.
- **Auditability**: every outcome should be explainable from configuration + aggregated metrics.
- **Fail-safe defaults**: closed partner endpoints (404 on missing scope), kill switches, reversible changes.
- **Minimal dependencies**: prefer platform primitives; new deps must be justified and removable.
- **No operational bloat**: avoid systems that require constant manual policing.

## Decision rules (how we decide)

Every change must answer:
- **Value**: what measurable outcome improves?
- **Risk**: privacy, incentives, abuse, dependency risk, and blast radius.
- **Reversibility**: can we roll back quickly without data loss?
- **Governance**: does it change external surfaces, data access, or economics? If yes → review required.

## Non-negotiables (never compromised)

- no raw user data to partners (no identifiers, no per-user trails)
- no partner leakage (no cross-partner comparisons/benchmarking)
- no deceptive UX (sponsored must be labeled; no misleading urgency)
- no rent-seeking economics (no unavoidable fixed fees without value delivery)
- no decentralization of governance rules/enforcement into ad-hoc exceptions

