# Stewardship Playbooks (Internal)

Objective: predictable responses to crises and ecosystem misuse without improvisation.

## Crisis response (platform integrity)

### Triggers
- ingestion failures sustained > 2h
- DB unreachable
- partner abuse (token brute force / scraping)
- governance alerts escalating to suspend/terminate

### Immediate actions (first 30 minutes)
- Confirm blast radius (which sites/partners)
- Activate kill switches:
  - disable affected partner scopes (config)
  - increase throttling / rate limits
- Preserve evidence:
  - capture timestamps + aggregated metrics
  - do not export raw logs

### Stabilization (same day)
- revert risky deployments
- run ingestion sweep and verify deal freshness
- postmortem write-up (root cause, fix, prevention)

## Partner disputes (commercial + trust)

### Standard process
- require written issue statement + desired remedy
- reproduce with the partner’s own statement outputs (aggregated)
- confirm governance status (warn/throttle/suspend)

### Allowed remedies
- adjust scopes/tier within policy
- correct attribution parameters (partner tag/site key)
- refund/credit within preview policies (if active billing later)

### Forbidden remedies
- bypass governance rules
- provide cross-partner comparative data
- ship “special case” forks

## Ecosystem misuse (abuse and policy violations)

### Examples
- scraping beyond rate limits
- injecting partner tokens into public pages
- attempting to extract user-level info
- deceptive co-branded content

### Response ladder
- warn: notify + tighten limits
- throttle: enforce reduced limits + add alerts
- suspend: disable scopes (tech) + written notice
- terminate: permanent disable + rotate secrets + public endpoints remain undiscoverable (404)

