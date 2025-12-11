import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { uploadPlugins } from "./uploadPlugins.js";

// Mock Firebase
vi.mock("../../utils/firebase.js", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

describe("Plugins Upload Tools", () => {
  const testLibraryFile = resolve(process.cwd(), "test-library.json");

  beforeEach(() => {
    // Clean up any existing test file
    try {
      require("fs").unlinkSync(testLibraryFile);
    } catch (e) {
      // File doesn't exist, that's fine
    }
  });

  describe("uploadPlugins", () => {
    it("should handle dry run mode", async () => {
      const testLibrary = {
        mcp: {
          filesystem: {
            name: "Filesystem Server",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
          },
          github: {
            name: "GitHub Server",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
          },
        },
      };

      writeFileSync(testLibraryFile, JSON.stringify(testLibrary));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "*",
        docId: "plugin-mcp-test",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
      expect(result.data).toBeDefined();
      expect(result.data?.pluginCount).toBe(2);
      expect(result.data?.organizationId).toBe("*");
    });

    it("should validate document ID naming convention", async () => {
      const testLibrary = {
        mcp: {
          filesystem: { name: "Test" },
        },
      };

      writeFileSync(testLibraryFile, JSON.stringify(testLibrary));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "*",
        docId: "invalid-doc-id", // Missing plugin-mcp- prefix
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must start with 'plugin-mcp-'");
    });

    it("should accept valid document ID", async () => {
      const testLibrary = {
        mcp: {
          filesystem: { name: "Test" },
        },
      };

      writeFileSync(testLibraryFile, JSON.stringify(testLibrary));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "*",
        docId: "plugin-mcp-core",
        dryRun: true,
      });

      expect(result.success).toBe(true);
    });

    it("should handle file not found", async () => {
      const result = await uploadPlugins({
        libraryFile: "non-existent-library.json",
        organizationId: "*",
        docId: "plugin-mcp-test",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle missing mcp key", async () => {
      writeFileSync(testLibraryFile, JSON.stringify({}));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "*",
        docId: "plugin-mcp-test",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No plugins found");
    });

    it("should handle organization-specific uploads", async () => {
      const testLibrary = {
        mcp: {
          "custom-plugin": { name: "Custom Plugin" },
        },
      };

      writeFileSync(testLibraryFile, JSON.stringify(testLibrary));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "org-abc-123",
        docId: "plugin-mcp-org-abc",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.organizationId).toBe("org-abc-123");
    });

    it("should provide sample plugins in result", async () => {
      const testLibrary = {
        mcp: {
          plugin1: { name: "Plugin 1" },
          plugin2: { name: "Plugin 2" },
          plugin3: { name: "Plugin 3" },
          plugin4: { name: "Plugin 4" },
        },
      };

      writeFileSync(testLibraryFile, JSON.stringify(testLibrary));

      const result = await uploadPlugins({
        libraryFile: testLibraryFile,
        organizationId: "*",
        docId: "plugin-mcp-test",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.samplePlugins).toBeDefined();
      expect(result.data?.samplePlugins.length).toBeLessThanOrEqual(3);
    });
  });
});
