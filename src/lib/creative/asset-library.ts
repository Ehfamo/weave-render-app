import type { CreativeAsset, CreativeAssetType } from "./contracts.ts";
export interface AssetPort {
  userId: string;
  canAccessProject(id: string): Promise<boolean>;
  list(projectId: string): Promise<CreativeAsset[]>;
  create(asset: Omit<CreativeAsset, "id" | "createdAt" | "updatedAt">): Promise<CreativeAsset>;
  archive(id: string): Promise<CreativeAsset | null>;
}
export class AssetLibrary {
  private port: AssetPort;
  constructor(port: AssetPort) {
    this.port = port;
  }
  private async auth(projectId: string) {
    if (!(await this.port.canAccessProject(projectId))) throw Error("ASSET_ACCESS_DENIED");
  }
  async list(projectId: string, options: { type?: CreativeAssetType; limit?: number } = {}) {
    await this.auth(projectId);
    const limit = options.limit ?? 50;
    if (limit < 1 || limit > 100) throw Error("INVALID_ASSET_LIMIT");
    return (await this.port.list(projectId))
      .filter(
        (a) =>
          a.ownerId === this.port.userId &&
          a.projectId === projectId &&
          a.status === "active" &&
          (!options.type || a.type === options.type),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((asset) => structuredClone(asset));
  }
  async register(input: Omit<CreativeAsset, "id" | "createdAt" | "updatedAt">) {
    await this.auth(input.projectId);
    if (
      input.ownerId !== this.port.userId ||
      input.version < 1 ||
      !input.name.trim() ||
      input.name.length > 200
    )
      throw Error("INVALID_ASSET");
    if (input.provenance.kind === "generation" && !input.generationId)
      throw Error("GENERATION_PROVENANCE_REQUIRED");
    return this.port.create(structuredClone(input));
  }
  async archive(projectId: string, id: string) {
    await this.auth(projectId);
    const asset = (await this.port.list(projectId)).find((a) => a.id === id);
    if (!asset || asset.ownerId !== this.port.userId || asset.projectId !== projectId)
      throw Error("ASSET_ACCESS_DENIED");
    return this.port.archive(id);
  }
}
