# XEOMX FI1 Recovery Preservation

Date: 2026-09-15

This branch preserves FI1 recoverable source changes without modifying `main` or Production.

Authoritative FI1 local branch:
`feature/xeomx-fi1-core-execution-20260914`

Authoritative FI1 local HEAD:
`dcafa525ebae0cf126e7470be3ca9de8065274aa`

Authoritative P9 parent:
`e14edacdcbb9705298a4865ca5d38e3f746ef202`

Original exact-history bundle SHA-256:
`5b31fff996977f07dbed850f217faa3d76f5f87f10a9f1015b49b62cb9e6dac5`

The raw 22 MB `.bundle` could not be uploaded through the connected GitHub interface because that connector does not expose binary-file upload from the local sandbox.

Instead, this branch contains `XEOMX_FI1_RECOVERY.patch.gz`, produced from:

`git format-patch --stdout e14edacdcbb9705298a4865ca5d38e3f746ef202..dcafa525ebae0cf126e7470be3ca9de8065274aa`

Recovery artifact SHA-256:
`f6ed7cef521734a5e37a4b891634f42f4cd25ce55f1e4c232586db1c4a0a8472`

The patch contains both FI1 commits, their messages, author metadata, and all source changes needed to reconstruct the validated FI1 state from the authoritative P9 parent.

Recovery example:

```bash
git checkout -b feature/xeomx-fi1-core-execution-20260914 e14edacdcbb9705298a4865ca5d38e3f746ef202
gzip -dc artifacts/fi1-preservation/XEOMX_FI1_RECOVERY.patch.gz | git am
```

After recovery, verify the resulting source tree and run the FI1 validation gates before continuing to FI2.

No claim is made that the reconstructed commit SHA will remain identical unless commit metadata and committer timestamps are also reproduced exactly. The original authoritative FI1 HEAD remains the SHA recorded above.
