# Technical Risk Audit (Auto-generated)

Generated: 2026-01-15T05:34:05.182Z

## Single points of failure

- **Database**: single Postgres instance (`DATABASE_URL`). If it’s down, both web + worker degrade.
- **Worker scheduling**: relies on cron execution environment (external scheduler / platform cron).

## Vendor dependencies

- **Neon/Postgres** (DB hosting)
- **Amazon outbound** (monetization via affiliate links)
- **OpenAI** (optional / future automation; can be disabled via env)

## Compliance exposure (high-level)

- Affiliate disclosures: present in footer; verify per-site domains.
- Click tracking: stores user-agent + referrer params; no raw IPs stored by design.
- AI content: logged to DB; ensure prompts/outputs are reviewable.

## Notes

- This is a static checklist. Final compliance review should be done by counsel for any transaction.
