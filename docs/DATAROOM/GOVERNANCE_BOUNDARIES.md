# Governance Boundaries (Internal)

Objective: define what can change, what requires review, and what is forbidden — without person-centric control.

## Roles (not individuals)

- **Operators**: run day-to-day operations, respond to incidents, execute playbooks.
- **Stewardship Review**: small group (2+ approvers) that reviews high-impact changes.

## What can change (no review required)

- routine content rotations (AI outputs) that follow existing policy rules
- partner rate limit tuning within documented caps
- site configuration updates within validated schema (branding/layout)

## What requires review (dual control)

- adding/changing partner API scopes
- changing economics defaults, billing modes, or monetization model parameters
- changing governance escalation rules or thresholds
- adding new external data surfaces
- introducing new external dependencies

## What is forbidden

- exceptions that bypass governance
- sharing raw event data or identifiers externally
- cross-partner benchmarking outputs
- unlabelled sponsorship or deceptive placement

