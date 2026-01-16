# Licensing Model Assumptions (Internal Draft)

This is a non-binding internal draft to align expectations before licensing/white-label deals.

## Pricing basis (examples)

- **Per-site monthly fee** + optional volume tier based on:
  - tracked impressions (proxy traffic) and/or
  - outbound clicks
- **Revenue share** option:
  - percentage of estimated or reported affiliate revenue

## Support expectations

- Included:
  - platform updates (security + bug fixes)
  - onboarding for one environment
  - operational runbook
- Excluded (unless contracted):
  - custom UI/branding work
  - bespoke ingestion sources
  - custom analytics pipelines

## Update cadence

- Regular cadence (e.g. weekly) for non-breaking updates
- Emergency patches for:
  - security issues
  - broken provider redirects
  - ingestion outages

## Control surfaces (licensee vs platform)

Licensee-controlled (config/admin):
- site definition + overrides (`config/sites.json`)
- provider enablement + IDs (`/admin/affiliate-settings`)

Platform-controlled (fixed):
- ingestion engine behavior
- tracking + event structure
- abuse prevention hooks + defaults

