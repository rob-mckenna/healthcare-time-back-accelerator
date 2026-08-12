# Synthetic Dataset — Governance Documentation

**Owner:** Morpheus (Data, Security, and Quality Engineer)
**Requirement IDs:** REQ-DATA-001, REQ-DATA-002, REQ-DATA-003, REQ-SCOPE-003
**Work Package:** WP-01

---

## Summary

This document describes the synthetic FHIR-shaped dataset created for the Second Shift Reduction Accelerator Option A prototype. All data is entirely fabricated and has no connection to any real patient, encounter, provider, or healthcare organization.

> **SYNTHETIC ONLY.** No real patient data, PHI, or PII is present anywhere in this dataset. The dataset may not be used outside a demonstration context and must not be represented as a real clinical record.

---

## Dataset location

| Path | Description |
|------|-------------|
| `data/synthetic/patients/SYN-PAT-PED0001A.json` | Standalone FHIR Patient resource |
| `data/synthetic/encounters/SYN-ENC-PEDENC001.json` | Standalone FHIR Encounter resource |
| `data/synthetic/bundles/SYN-BDL-PEDBDL01.json` | Approved synthetic source bundle — the system-of-record for the prototype |

The bundle is the authoritative artifact consumed by the Shift Closeout Agent. Individual patient and encounter files are provided for human readability and scenario documentation.

---

## Identifier conventions

All synthetic identifiers carry the `SYN-` prefix, which makes real clinical record identifiers structurally invalid in this context. Required prefix patterns:

| Identifier type | Pattern |
|-----------------|---------|
| Patient | `SYN-PAT-[A-Z0-9]{8,16}` |
| Encounter | `SYN-ENC-[A-Z0-9]{8,16}` |
| Bundle | `SYN-BDL-[A-Z0-9]{8,16}` |
| Resource (generic) | `SYN-[A-Z]{3,4}-[A-Z0-9]{8,16}` |

---

## Dataset contents

The bundle `SYN-BDL-PEDBDL01` contains nine entries sufficient for a credible pediatric shift closeout with two or three distinct open items:

| Resource ID | Type | Description |
|-------------|------|-------------|
| `SYN-PAT-PED0001A` | Patient | Fictional pediatric patient — Aurora Testcase, 2018-04-11, female |
| `SYN-ENC-PEDENC001` | Encounter | Night shift inpatient encounter, in-progress, class IMP |
| `SYN-OBS-OBS00001` | Observation | Documented respiratory rate entry — 22 breaths/min at 23:15Z |
| `SYN-OBS-OBS00002` | Observation | Documented temperature entry — 37.6 °C at 01:00Z |
| `SYN-TSK-TSK00001` | Task | Open item: education material handout not yet acknowledged (routine) |
| `SYN-TSK-TSK00002` | Task | Open item: documented pain-assessment check pending for next shift (routine) |
| `SYN-SRQ-SRQ00001` | ServiceRequest | Follow-up: documented lab review requested at next check-in |
| `SYN-CPL-CPL00001` | CarePlan | Active care plan with one documented follow-up activity for the next shift |
| `SYN-PRAC-RN000001` | Practitioner | Sample care-team reference — Sample Nurse-Testcase |

---

## Approval and governance gate

The bundle carries `approvedForGeneration: true`, `approvedByRef: SYS-DATAGOV0001`, and `approvedAt`. The Shift Closeout Agent must refuse to read any bundle where `approvedForGeneration` is not `true`.

The `bundleSha256` field is a placeholder value (`1a2b3c...`) consistent with the contract examples. In a production deployment this value would be a real SHA-256 digest over the canonical bundle content, and the agent input contract would carry the same value to bind generation to an exact source snapshot.

---

## Prohibited identifier fields

The `synthetic-context.schema.json` contract contains an explicit property denylist enforced by `additionalProperties: false`. The following fields must never appear in any synthetic record:

`ssn`, `socialSecurityNumber`, `taxId`, `mrn`, `medicalRecordNumber`, `patientAccountNumber`, `address`, `streetAddress`, `postalCode`, `phone`, `telecom`, `email`, `insuranceId`, `memberId`, `photo`, `nextOfKin`, `emergencyContact`, `birthDateTime`

---

## Validation

```bash
# Validates the bundle against synthetic-source-bundle.schema.json
node scripts/validate-contracts.mjs

# Asserts no credentials or direct identifiers are present
node scripts/scan-secrets.mjs

# Runs the governance check suite including dataset structure checks
node src/governance/test/run-governance-checks.mjs
```

---

## Fictional name notice

The patient display name "Aurora Testcase" is entirely fictional and was chosen to be recognisably synthetic. The family name "Testcase" is not used in clinical practice and makes the fictional nature of the record immediately apparent to any reviewer.
