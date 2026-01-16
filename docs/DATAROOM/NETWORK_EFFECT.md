# Network Effect Acceleration (Internal)

Objective: strengthen **one** dominant flywheel without adding conflicting incentives.

## Primary flywheel (single loop)

**Partners → more attributed clicks → better signals → better surfaced deals → higher partner yield → more partners**

This keeps incentives aligned:
- partners win when deal quality + conversion improves
- platform wins only when partners earn (via aligned economics)

## Friction removal (what we optimize)

- **Faster feedback**: partners can see their aggregated outcomes quickly (no waiting for manual reports)
- **Reduced latency**: surface ingestion freshness and inventory staleness signals
- **Clear incentives**: show CTR/yield changes and what inputs drive them (impressions + outbound attribution)

## Loop health instrumentation (what we track)

### Participation growth

- configured partners
- active partners (≥5 clicks / 7d)
- active partner growth vs prior 7d

### Quality signals

- partner CTR (7d vs prior 7d)
- governance state distribution (throttle/suspend)

### Yield improvements

- estimated revenue (7d vs prior 7d)
- yield per click (cents/click) trend

## Surfaces

- Admin: `/admin/network` — operator view of loop health (participation/quality/yield/latency)
- Partner: `GET /api/partners/<partner>/v1/loop-health?days=30` — partner-only fast feedback (aggregated, no PII)

