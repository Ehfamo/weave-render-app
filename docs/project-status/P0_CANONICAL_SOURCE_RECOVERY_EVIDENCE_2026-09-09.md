# XEOMX P0 Canonical Source Recovery Evidence — 2026-09-09

Current status: **EXACT_CANONICAL_IDENTITY_RECOVERED; P0 BLOCKED_BY_SOURCE_TEST_AND_SCHEMA_DEFECTS**

Fresh closure attempt: [P0/P1 execution report](P0_P1_EXECUTION_REPORT_2026-09-09.md). The four current canonical hashes and byte counts match. Workflow run 34367076011 at 9d6284d58f4143284996c9ee071cabc528944048 still has real source failures. P1 has not started.

## Historical recovery record (preserved)

Historical status before materialization: **BLOCKED_ON_EXACT_BASELINE_RECOVERY**

Safety: **NO MERGE / NO PRODUCTION DEPLOY / NO PRODUCTION SUPABASE WRITE / NO DNS CHANGE / STAGE 6 NOT STARTED**

## Why this is a release blocker

The latest Stage 5.4 continuation audit identified four source files present in earlier Golden manifests but absent from the current sealed Stage 5.4 Golden package / verification source. Because the prior 114/114 regression was executed against a source state that cannot currently be reconstructed byte-for-byte, the release source is not yet reproducible.

## Exact historical file identities

The Stage 3 canonical manifest records:

| File | Bytes | SHA256 |
|---|---:|---|
| `src/lib/product-architecture.ts` | 48,412 | `5c1cb52a5b1d692d18aa92adc558170bd4ca9d3fb732a0f45ee37485e3712504` |
| `src/lib/core-workflows.ts` | 18,262 | `fce4fb9d01bafd808f45dcd241323ab5c99ada8057f757a10f11afaf93b023f1` |
| `src/lib/platform-contracts.ts` | 21,587 | `840e9e012c244652492021223bbd55ae562bf702f06b65d03a67d81c50d5c4f2` |
| `src/components/xeomx/product/ProductWorkspacePreview.tsx` | 31,144 | `5504a029910f04541f61b7876fe2df60ab18e2d18f188a2e89d823302f948a11` |

These hashes are treated as immutable recovery evidence.

## Checks performed on 2026-09-09

### GitHub

- `verify/stage5-4-source-compare-20260815`: direct fetch of missing architecture files returns 404.
- `verify/stage54-from-step4-20260815`: direct fetch of missing architecture files returns 404.
- `payload/stage54-core-v2-20260815`: no recoverable `product-architecture.ts`.
- The Step 4 branch contains temporary exact-source verification assets and patch fragments, not the four baseline files as normal source paths.
- GitHub default-history path query for `src/lib/product-architecture.ts` returned no commit history, supporting the conclusion that this source lived in Golden artifacts rather than normal `main` history.

### Google Drive

Historical Step 3 reconstruction documentation states the intended recovery chain:

```text
XEOMX_GOLDEN_RECONCILED_2026-08-14.zip
  + XEOMX_STEP3_P0_CLOSURE_SOURCE_2026-08-14.patch
  -> Step 3 source
```

The Step 3 folder still contains reconstruction documentation, patch, manifest/checksum/evidence/log artifacts, but the required baseline ZIP is not currently discoverable through the connected Drive search.

Additional searches completed:

- exact active-name search for `XEOMX_GOLDEN_RECONCILED_2026-08-14.zip`: not found
- Trash exact-name search: not found
- Trash `name contains 'GOLDEN_RECONCILED'`: not found

The current Stage 5.4 ZIP is not a replacement because the continuation audit already proved the four files are absent from it.

## Source patches

- Step 4 patch does not contain `product-architecture.ts`; the missing files were baseline content rather than Step 4 additions.
- Step 3 source delta likewise does not provide the four complete baseline files.

Therefore reconstructing only from the surviving deltas cannot recover the historical bytes.

## Rejected recovery methods

The following are explicitly prohibited for canonical recovery:

- inventing file contents from architecture spreadsheets
- reconstructing from names/interfaces alone
- using AI-generated approximations and calling them historical source
- copying unrelated current files into the missing paths
- accepting files whose SHA256 does not match the manifest while claiming exact recovery

## Valid resolution paths

### Path A — Exact recovery [preferred]

Locate a historical source/archive containing all four files, extract them, and require exact byte length + SHA256 match for each file. Then reconcile Stage 5.4 hardening on an isolated branch and rerun all verification.

### Path B — Explicit clean reconstruction

If exact historical bytes are permanently unavailable, create new implementations from the current v4.1 architecture and observable consumers on an isolated branch. These files must be labeled **NEW RECONSTRUCTION**, receive new hashes, and the previous 114/114 evidence must not be inherited. A complete source/build/test/E2E baseline must be generated from scratch before release.

Path B is not equivalent to historical recovery and must never be described as such.

## P0 exit requirements after recovery/reconstruction

1. One canonical source branch/commit.
2. Fresh exact dependency install from lockfile.
3. Build PASS.
4. Typecheck PASS.
5. Lint PASS.
6. Full regression PASS.
7. Integration PASS.
8. Migration tests PASS.
9. Smoke PASS.
10. Secret/supply-chain checks PASS.
11. New manifest and SHA256 inventory.
12. Exact isolated staging deployment.
13. J01–J12 Route and Action E2E.
14. Browser Security / axe Accessibility / Lighthouse Performance gates.

Until these conditions are met, no P1–P7 runtime framework is allowed into the release source.
