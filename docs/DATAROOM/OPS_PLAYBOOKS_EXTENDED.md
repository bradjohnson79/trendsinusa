# Operational Playbooks (Extended) — Internal

Objective: predictable operations without adding ongoing complexity.

## Dependency failure (DB / hosting / vendor)

### DB failure
- **Detect**: DB status shows non-ready; ingestion failures spike; public pages degrade to empty states
- **Immediate**:
  - confirm credentials + connectivity
  - verify migrations applied (admin DB status panel)
  - pause scheduled ingestion if it is thrashing
- **Recovery**:
  - restore connectivity
  - run migrate deploy (no schema changes unless approved)
  - rerun ingestion once

### Vendor failure (AI provider)
- **Detect**: AI failures (24h) spike; missing `OPENAI_API_KEY`
- **Immediate**:
  - disable AI job runs (scheduler config) if needed
  - keep cached/previous content (no runtime generation)
- **Recovery**:
  - rotate key / switch model
  - re-run daily AI job with logging

## Revenue disruption (affiliate)

### Symptoms
- outbound clicks normal but estimated revenue drops
- affiliate config missing/disabled
- provider concentration becomes extreme

### Actions
- verify `AffiliateConfig` enabled and associate tag present
- verify provider configs enabled/priorities
- if provider terms change: adjust provider routing priorities (config) and keep Amazon fallback

## Regulatory changes (privacy, disclosures)

Principle: change wording and controls, not data exposure.
- update footer disclosures and partner terms (docs)
- keep raw data internal; aggregated outputs remain thresholded
- add or tighten scopes for any new surface (default closed)

