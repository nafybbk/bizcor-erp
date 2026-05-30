---
name: Activation Logs Feature
description: PC-wise and voucher-wise activation history tracking for both cloud and LAN versions
---

## Feature: Activation History / PC-wise Activation Log

### What user wants
- Tech panel mein har activation ka record — kon sa voucher, kon si PC, kab
- PC-wise view: ek hardware fingerprint pe kitne plans activate huye, kon se voucher codes
- Voucher-wise view: voucher ne kahan activate hua, kis PC pe, kab, EXE version
- PC format/change detect ho (fingerprint change se)
- Fraud/misuse track karna

### Design agreed
- Naya `activation_logs` table — har activation event pe ek row
- Fields: `businessCode`, `voucherCode`, `hardwareFingerprint`, `ip`, `exeVersion`, `activatedAt`
- Dono cloud (PostgreSQL) aur LAN (SQLite) ke liye

### Risk assessment (discussed, approved low-risk)
- Additive only — koi existing table/column nahi badalta
- Log write non-blocking — try/catch mein, failure pe activation nahi rukegi
- SQLite migration pattern already hai (v2.3.72 se)
- Tech panel UI read-only display

**Why:** Current system mein sirf ek record per voucher hai (licenseVouchers.notes JSON). Multiple activations track nahi hoti, PC change detect nahi hota.

**How to apply:** Naya table schema likho, SQLite auto-migration mein add karo, activate-offline + redeem-voucher-offline routes mein log write karo (try/catch), tech panel mein "Activation Logs" tab banao.
