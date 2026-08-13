import assert from "node:assert/strict";
import test from "node:test";
import { validateResearchCitations } from "../supabase/functions/xeomx-generation-worker/citation-validation.mjs";

test("research citations accept only provided source ids", () => {
  assert.deepEqual(
    validateResearchCitations("Bindings expose resources [1] and services [2].", [1, 2, 3]),
    {
      ok: true,
      reason: null,
      citedIds: [1, 2],
    },
  );
});

test("research citations require at least one citation", () => {
  assert.deepEqual(validateResearchCitations("Bindings expose resources.", [1, 2, 3]), {
    ok: false,
    reason: "missing_citation",
    citedIds: [],
  });
});

test("research citations reject unknown source ids", () => {
  assert.deepEqual(validateResearchCitations("Unsupported claim [4].", [1, 2, 3]), {
    ok: false,
    reason: "unknown_citation",
    citedIds: [],
  });
});

test("research citations reject malformed numeric citation groups", () => {
  assert.deepEqual(validateResearchCitations("Claim [1,2].", [1, 2, 3]), {
    ok: false,
    reason: "malformed_citation",
    citedIds: [],
  });
});
