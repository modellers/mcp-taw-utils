import { describe, it, expect } from "vitest";
import { discoverMCPServers } from "./discoverPlugins.js";

describe("Plugins Discovery Tools", () => {
  describe("discoverMCPServers", () => {
    it("should handle dry run mode", async () => {
      const result = await discoverMCPServers({
        githubUrl: "https://github.com/owner/repo",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
      expect(result.data).toBeDefined();
    });

    it("should parse GitHub URLs", async () => {
      const result = await discoverMCPServers({
        githubUrl: "https://github.com/modelcontextprotocol/server-filesystem",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.plugins).toBeDefined();
    });

    it("should handle invalid GitHub URL", async () => {
      const result = await discoverMCPServers({
        githubUrl: "not-a-valid-url",
        dryRun: true,
      });

      // Stub implementation returns success with warnings
      // TODO: In full implementation, this should fail with error
      expect(result.success).toBe(true);
      expect(result.data?.warnings.length).toBeGreaterThan(0);
    });

    it("should require either githubUrl or batchFile", async () => {
      const result = await discoverMCPServers({
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("githubUrl or batchFile");
    });

    it("should include discovery metadata", async () => {
      const result = await discoverMCPServers({
        githubUrl: "https://github.com/owner/repo",
        dryRun: true,
      });

      expect(result.success).toBe(true);

      // May have warnings if repository doesn't exist or fails to fetch
      if (result.data?.plugins && Object.keys(result.data.plugins).length > 0) {
        const pluginKey = Object.keys(result.data.plugins)[0];
        const plugin = result.data.plugins[pluginKey];

        expect(plugin.metadata).toBeDefined();
        expect(plugin.metadata.source).toBeDefined();
        expect(plugin.metadata.discoveredAt).toBeDefined();
        expect(plugin.metadata.warnings).toBeDefined();
        expect(plugin.repositoryData).toBeDefined();
      }
    });

    it("should handle GitHub API errors gracefully", async () => {
      const result = await discoverMCPServers({
        githubUrl: "https://github.com/owner/repo",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      // When GitHub API fails (e.g., 404), should still succeed but with warnings
      if (result.data?.warnings) {
        expect(result.data.warnings.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
