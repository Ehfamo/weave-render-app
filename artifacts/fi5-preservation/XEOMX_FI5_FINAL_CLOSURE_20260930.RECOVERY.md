# FI5 exact final recovery — 2026-09-30

Repository: Ehfamo/weave-render-app

Final FI5: `cba07c197f3278efec81d125c969f25a406fd958`

Prerequisite FI4: `b8238f9ed6c82399f89fbc80ba2a8c61d398de60`

Branch: `feature/xeomx-fi5-marketplace-commerce-lifecycle-20260924`

Bundle: `XEOMX_FI5_FINAL_CLOSURE_20260930.bundle`

SHA-256: `cd88f216dcb2e45e81e443bfc22a63375338618b2dd3d347149b243b132cb75c`

This incremental bundle preserves all FI5 commits after the exact FI4 prerequisite.
Download it as binary from this branch. Do not modify decoded bytes.
From a repository containing the prerequisite:

```sh
sha256sum XEOMX_FI5_FINAL_CLOSURE_20260930.bundle
git bundle verify XEOMX_FI5_FINAL_CLOSURE_20260930.bundle
git bundle list-heads XEOMX_FI5_FINAL_CLOSURE_20260930.bundle
git fetch XEOMX_FI5_FINAL_CLOSURE_20260930.bundle refs/heads/feature/xeomx-fi5-marketplace-commerce-lifecycle-20260924:refs/heads/recovered-fi5-20260930
git rev-parse recovered-fi5-20260930
git merge-base --is-ancestor b8238f9ed6c82399f89fbc80ba2a8c61d398de60 recovered-fi5-20260930
```

The recovered head must equal the final FI5 SHA above. A separate recovered ref avoids
checking out over a dirty working tree. Never reset existing work or force-push.
The scoped GitHub workflow verifies bytes/ancestry and normally advances only the FI5
branch. It does not deploy, migrate, run providers, touch main or transfer money.

The source-branch manifest is a pre-publication validation record. This preservation
branch contains the finalized manifest with literal commit and bundle identities and
independent remote verification. The manifest is outside the bundled final commit to
avoid circular hashes. FI6 is not started.
