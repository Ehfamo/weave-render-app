import test from "node:test";
import assert from "node:assert/strict";
import { AssetLibrary } from "../src/lib/creative/asset-library.ts";
import {
  moveItem,
  normalizeTimeline,
  serializeTimeline,
  totalDuration,
} from "../src/lib/creative/timeline.ts";
import { CreativeWorkspaceService } from "../src/lib/creative/workspace.ts";
import { CreativeConsistencyService } from "../src/lib/creative/consistency.ts";
import { classifyIntent, actionTarget } from "../src/lib/command-center/actions.ts";
const now = "2026-09-12TT00:00:00Z",
  user = "u1",
  project = "p1";
const asset = (id, type = "image", p = project, u = user) => ({
  id,
  ownerId: u,
  projectId: p,
  type,
  name: id,
  status: "active",
  metadata: {},
  provenance: { kind: "upload" },
  version: 1,
  createdAt: now,
  updatedAt: now,
});
function library() {
  const rows = [asset("a1"), asset("a2", "video"), asset("alien", "image", "p2", "u2")];
  const port = {
    userId: user,
    canAccessProject: async (id) => id === project,
    list: async () => rows,
    create: async (x) => ({ ...x, id: "new", createdAt: now, updatedAt: now }),
    archive: async (id) => ({ ...rows.find((x) => x.id === id), status: "archived" }),
  };
  return new AssetLibrary(port);
}
test("asset library enforces tenant/project isolation filters and provenance", async () => {
  const l = library();
  assert.deepEqual(
    (await l.list(project)).map((x) => x.id),
    ["a1", "a2"],
  );
  assert.deepEqual(
    (await l.list(project, { type: "video" })).map((x) => x.id),
    ["a2"],
  );
  await assert.rejects(() => l.list("p2"), /ACCESS/);
  await assert.rejects(
    () => l.register({ ...asset("x"), id: undefined, provenance: { kind: "generation" } }),
    /PROVENANCE/,
  );
});
const timeline = () => ({
  id: "tl",
  projectId: project,
  version: 1,
  updatedAt: now,
  scenes: [
    { id: "s2", name: "B", order: 2, notes: "" },
    { id: "s1", name: "A", order: 1, notes: "" },
  ],
  tracks: [
    {
      id: "v",
      kind: "video",
      order: 1,
      items: [
        {
          id: "i2",
          sceneId: "s2",
          trackId: "v",
          assetId: "a2",
          start: 5,
          duration: 3,
          order: 2,
          status: "active",
        },
        {
          id: "i1",
          sceneId: "s1",
          trackId: "v",
          assetId: "a1",
          start: 0,
          duration: 5,
          order: 1,
          status: "active",
        },
      ],
    },
  ],
});
test("timeline orders serializes moves assets and calculates duration deterministically", () => {
  const t = normalizeTimeline(timeline());
  assert.deepEqual(
    t.scenes.map((x) => x.id),
    ["s1", "s2"],
  );
  assert.equal(totalDuration(t), 8);
  assert.equal(moveItem(t, "i2", "v", 4, 2).tracks[0].items[1].start, 4);
  assert.equal(serializeTimeline(t), serializeTimeline(normalizeTimeline(t)));
});
test("timeline rejects invalid items", () => {
  const t = timeline();
  t.tracks[0].items[0].duration = 0;
  assert.throws(() => normalizeTimeline(t), /INVALID/);
});
function workspace() {
  const tl = timeline(),
    ws = { projectId: project, selectedCharacterIds: [], timeline: tl };
  const port = {
    userId: user,
    canEditProject: async (id) => id === project,
    loadWorkspace: async () => ws,
    saveWorkspace: async () => {},
    listCharacters: async () => [
      {
        id: "c1",
        projectId: project,
        name: "N",
        assetIds: ["a1"],
        visualTraits: {},
        lookAssetIds: [],
        approvedVariationAssetIds: [],
        continuityNotes: ["same face"],
        version: 1,
        provenance: "user",
      },
    ],
    listVoices: async () => [
      {
        id: "v1",
        projectId: project,
        name: "V",
        assetIds: [],
        style: "warm",
        instructions: [],
        memoryId: "m1",
      },
    ],
    listBrands: async () => [
      {
        id: "b1",
        projectId: project,
        name: "B",
        assetIds: [],
        colors: ["#000"],
        style: "dark",
        instructions: [],
        memoryId: "m2",
      },
    ],
    listGenerations: async () => [],
    submitGeneration: async (x) => ({
      requestId: x.id,
      jobId: "j1",
      status: "queued",
      version: 1,
      createdAt: now,
    }),
  };
  const brain = {
    snapshot: async () => ({
      summary: { text: "Campaign", method: "deterministic" },
      instructions: [{ text: "same character" }],
      constraints: [],
      memories: [],
    }),
  };
  return new CreativeWorkspaceService(port, library(), brain);
}
test("workspace loads bounded Project Brain context and canonical references", async () => {
  const s = await workspace().load(project);
  assert.match(s.context, /same character/);
  assert.equal(s.characters[0].projectId, project);
  assert.equal(s.voices[0].memoryId, "m1");
  assert.equal(s.brands[0].memoryId, "m2");
});
test("generation remains provider neutral and rejects cross-project references", async () => {
  const s = workspace(),
    base = {
      id: "g1",
      userId: user,
      projectId: project,
      intent: "video",
      prompt: { text: "ad", durationSeconds: 15 },
      references: [{ assetId: "a1", role: "source", version: 1 }],
      characterIds: ["c1"],
      voiceId: "v1",
      brandId: "b1",
      quality: "BALANCED",
      createdAt: now,
    };
  assert.equal((await s.requestGeneration(base)).status, "queued");
  await assert.rejects(
    () =>
      s.requestGeneration({
        ...base,
        references: [{ assetId: "alien", role: "source", version: 1 }],
      }),
    /REFERENCE_DENIED/,
  );
  assert.equal(JSON.stringify(base).includes("provider"), false);
});
test("creative continuity reuses scoped character voice and brand memory", async () => {
  const state = await workspace().load(project);
  const memory = {
    relevant: async ({ scope, types }) => {
      assert.equal(scope.projectId, project);
      assert.deepEqual(types, ["CharacterMemory", "VoiceMemory", "BrandMemory"]);
      return [
        {
          memory: { id: "m1", type: "VoiceMemory", content: "Warm voice" },
          relevance: 1,
          method: "lexical",
        },
        {
          memory: { id: "unselected", type: "BrandMemory", content: "Other brand" },
          relevance: 1,
          method: "lexical",
        },
      ];
    },
  };
  const service = new CreativeConsistencyService(memory);
  const context = await service.context(project, {
    characters: state.characters,
    voice: state.voices[0],
    brand: state.brands[0],
  });
  assert.deepEqual(context.characters[0].notes, ["same face"]);
  assert.deepEqual(
    context.memories.map((item) => item.id),
    ["m1"],
  );
  await assert.rejects(
    () =>
      service.context(project, {
        characters: [{ ...state.characters[0], projectId: "another-project" }],
      }),
    /REFERENCE_DENIED/,
  );
});
test("Command Center sends creative goals to one workspace", () => {
  assert.equal(classifyIntent("Create an ad").action, "create");
  assert.equal(actionTarget("create"), "/creative-workspace");
});
