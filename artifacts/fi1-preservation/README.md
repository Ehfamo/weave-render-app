# XEOMX FI1 Recovery Preservation

Date: 2026-09-15

This preservation branch exists only to keep FI1 recoverable on GitHub while the exact FI1 branch cannot be pushed from the worker because HTTPS credentials are unavailable.

## Authoritative state

- P9 parent: `e14edacdcbb9705298a4865ca5d38e3f746ef202`
- FI1 local branch: `feature/xeomx-fi1-core-execution-20260914`
- FI1 authoritative local HEAD: `dcafa525ebae0cf126e7470be3ca9de8065274aa`
- Original exact Git bundle SHA-256: `5b31fff996977f07dbed850f217faa3d76f5f87f10a9f1015b49b62cb9e6dac5`

The connected GitHub interface cannot upload the 22 MB local `.bundle` directly. Therefore the two FI1 commits are preserved here as an exact compressed `git format-patch`, split into eight small binary chunks.

## Authoritative recovery artifact

Directory:

`artifacts/fi1-preservation/chunks/`

Concatenate exactly in numeric order:

```bash
cat artifacts/fi1-preservation/chunks/part-* > XEOMX_FI1_RECOVERY.patch.gz
sha256sum XEOMX_FI1_RECOVERY.patch.gz
```

Required SHA-256:

`f6ed7cef521734a5e37a4b891634f42f4cd25ce55f1e4c232586db1c4a0a8472`

The compressed patch was generated from:

```bash
git format-patch --stdout e14edacdcbb9705298a4865ca5d38e3f746ef202..dcafa525ebae0cf126e7470be3ca9de8065274aa | gzip -n -c
```

See `CHUNKS_MANIFEST.md` for per-part sizes and hashes.

## Recovery

```bash
git checkout -b feature/xeomx-fi1-core-execution-20260914 e14edacdcbb9705298a4865ca5d38e3f746ef202
cat artifacts/fi1-preservation/chunks/part-* > /tmp/XEOMX_FI1_RECOVERY.patch.gz
printf '%s  %s\n' 'f6ed7cef521734a5e37a4b891634f42f4cd25ce55f1e4c232586db1c4a0a8472' '/tmp/XEOMX_FI1_RECOVERY.patch.gz' | sha256sum -c -
gzip -dc /tmp/XEOMX_FI1_RECOVERY.patch.gz | git am
```

Then run the FI1 validation gates before starting FI2.

Important: this recovery artifact preserves all FI1 source changes and patch commit metadata required for recovery. The authoritative original FI1 HEAD remains `dcafa525ebae0cf126e7470be3ca9de8065274aa`. Do not claim the recovery branch HEAD itself is the FI1 HEAD.

No `main`, Production, DNS, Production Supabase, payment, or payout state was changed by this preservation branch.
