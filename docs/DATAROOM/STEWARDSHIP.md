# Platform Stewardship Charter (Internal)

Objective: ensure the platform remains coherent, trusted, and steward-controlled over time (role-based, not person-based).

## 1) Stewardship principles

### What will never be compromised (non-negotiables)

- **Stewardship control (role-based)**: final authority over policy, economics, and partner access remains centralized in documented governance (dual-control review), not ad-hoc individuals.
- **Privacy**: no raw user data in partner outputs; no identifiers; aggregates only; minimum-threshold suppression.
- **Truthfulness**: no deceptive UI, no misleading “countdowns,” no hidden sponsorship.
- **Safety by default**: fail closed for partner endpoints (404 on missing scope; hard kill switches).
- **Auditability**: decisions are explainable from stored configuration + aggregated metrics.
- **No forks**: one core engine; white-labeling is configuration-driven.

### What can evolve (allowed change surfaces)

- ingestion sources and normalization strategies (while preserving stable contracts)
- ranking/surfacing logic (as long as it’s auditable and doesn’t mislead users)
- affiliate provider support (without breaking Amazon fallback)
- partner API schemas (versioned, with deprecation windows)
- internal automation (when safety and rollback exist)

### What is forbidden (hard red lines)

- exposing per-user event trails, IPs, user agents, or identifiers to partners
- partner-specific leakage (cross-partner comparisons, portfolio totals, competitor benchmarking)
- “rent-seeking” pricing (unavoidable fixed fees without value delivery)
- incentives that reward low-quality/sponsored content over user trust
- unreviewed external dependencies that expand the attack surface (see dependency caps)
- decentralizing authority over governance rules or enforcement mechanisms

## 2) Decision standard

Every major change must answer:
- **Who benefits?** (users, partners, platform) and **how measured**
- **What could go wrong?** (abuse, incentives, privacy, compliance)
- **How do we roll back?** (safe defaults, kill switches, reversibility)

