# Data Moat Formalization (Internal)

Objective: formalize the platform’s data advantage as a long-term moat **without exposing raw data externally** and without weakening privacy.

## 1) Compounding data assets (what improves with time)

### Longitudinal deal performance

What it is:
- time-series of deal availability and outcomes (exposure → outbound clicks) over many days/weeks
- performance segmented by deal state (ACTIVE/EXPIRING_*) and placement types

Why it compounds:
- patterns emerge only with repeated cycles and seasonality
- enables stable baselines and anomaly detection

### Contextual conversion patterns

What it is:
- CTR and yield proxies by section, badge/CTA variants, time-to-expiry buckets
- partner-attributed vs organic overlap (proxy, aggregated)

Why it compounds:
- better attribution fidelity over time
- improves experimentation priors and reduces noisy iteration

### Temporal price behavior

What it is:
- discount distributions and volatility proxies for categories over time
- “price sanity” gating learnings (what breaks trust)

Why it compounds:
- value comes from longitudinal distribution shifts, not single snapshots

### Cross-site trend learning

What it is:
- aggregated performance differences across sites (internal only)
- category momentum deltas over time

Why it compounds:
- cross-site learning reveals which patterns generalize vs are site-specific

## 2) Data tiers (classification and allowed uses)

### Tier A — Raw (internal only)

Definition:
- any event-level records (e.g. `ClickEvent` rows), ingestion runs, internal logs

Rules:
- never shared externally
- never exported in a form that enables reconstruction of user-level trails
- access limited to operators and core engineers

### Tier B — Aggregated (restricted)

Definition:
- time-windowed aggregates with minimum-threshold suppression (k-anonymity-ish)
- examples: counts, rates, distributions, bucketed trends

Rules:
- can power internal dashboards
- may be exposed to partners **only** when:
  - partner-attributed only (no cross-partner leakage)
  - thresholded and time-windowed
  - no competitor benchmarking

### Tier C — Intelligence outputs (controlled)

Definition:
- “interpreted” aggregates (ranked momentum, suggestions, health indicators)

Rules:
- externally shareable only as *controlled outputs* with:
  - explicit assumptions
  - strict scopes/tiering
  - export restrictions

## 3) Why these datasets are hard to scrape or recreate

### Cannot be scraped easily
- true outcomes depend on:
  - partner attribution via platform outbound redirects
  - internal impressions/events (not visible in HTML)
  - governance-thresholded aggregates

### Cannot be recreated quickly
- requires:
  - longitudinal collection (weeks/months)
  - stable ingestion + normalization over time
  - consistent section/tag semantics and site routing

### Improves with time, not scale alone
- more traffic helps, but the moat is:
  - seasonality coverage
  - longitudinal baselines
  - cross-site comparative learning (internal only)

## 4) Retention + protection policies (locking the moat)

### Access rules
- Tier A (raw): only internal; least-privilege
- Tier B/C: scoped, tiered, and partner-isolated

### Export restrictions
- no raw exports to partners
- no cross-partner comparative exports
- any future exports must be:
  - aggregated
  - thresholded
  - time-windowed
  - versioned with deprecation windows

### Internal usage principles
- prefer aggregated views for routine analysis
- treat raw event access as “break glass”
- changes to partner scopes/data surfaces require Stewardship Review (dual control) (see stewardship)

