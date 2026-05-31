---
name: Maintenance Plan Feature
description: Yearly maintenance fee added to plans (especially lifetime), with expiry alerts and feature locks
---

## Feature: Maintenance Plan

### What user wants
- Plan creation mein "Maintenance" field: ₹X / Yearly or Monthly
- Lifetime/OneTime plan ke saath bhi maintenance alag se chale
- Expire hone se 30/15/7/1 din pehle alert
- Optional (not mandatory) — business choose kare

### Lock on expiry (agreed)
- Auto backup (week history hold)
- Multi-style reports (lock → default style only)
- Excel/PDF export
- Tech support / chat
- New software updates/versions

### NOT locked (core features stay)
- Voucher entry, party/item masters
- Basic reports (ledger, outstanding)
- Existing data access

### Implementation notes
- Multi-style reports must be built first (prerequisite)
- Enforcement: soft lock (banner + feature disable), not full app lock
- Alert banner in app when maintenance < 30 days remaining

**Why:** Recurring revenue stream on lifetime plan holders without alienating them by locking core functionality.
