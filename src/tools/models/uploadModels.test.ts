import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { uploadModels } from "./uploadModels.js";

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

describe("Models Upload Tools", () => {
  const testModelsFile = resolve(process.cwd(), "test-models.json");

  beforeEach(() => {
    // Clean up any existing test file
    try {
      require("fs").unlinkSync(testModelsFile);
    } catch (e) {
      // File doesn't exist, that's fine
    }
  });

  describe("uploadModels", () => {
    it("should handle dry run mode", async () => {
      // Create test models file
      const testModels = {
        "openai/gpt-4": {
          model_name: "gpt-4",
          name: "GPT-4",
          provider: "openai",
        },
        "anthropic/claude-3": {
          model_name: "claude-3",
          name: "Claude 3",
          provider: "anthropic",
        },
      };

      writeFileSync(testModelsFile, JSON.stringify(testModels));

      const result = await uploadModels({
        modelsFile: testModelsFile,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
      expect(result.data).toBeDefined();
      expect(result.data?.totalModels).toBe(2);
      expect(result.data?.providerCount).toBe(2);
    });

    it("should handle wrapped format", async () => {
      const wrappedModels = {
        type: "models",
        models: {
          "openai/gpt-4": {
            model_name: "gpt-4",
            name: "GPT-4",
          },
        },
      };

      writeFileSync(testModelsFile, JSON.stringify(wrappedModels));

      const result = await uploadModels({
        modelsFile: testModelsFile,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalModels).toBe(1);
    });

    it("should group models by provider", async () => {
      const testModels = {
        "openai/gpt-4": { model_name: "gpt-4" },
        "openai/gpt-3.5": { model_name: "gpt-3.5" },
        "anthropic/claude-3": { model_name: "claude-3" },
      };

      writeFileSync(testModelsFile, JSON.stringify(testModels));

      const result = await uploadModels({
        modelsFile: testModelsFile,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.providerCount).toBe(2);
      expect(result.data?.providers).toHaveLength(2);

      const openaiProvider = result.data?.providers.find((p) =>
        p.docName.includes("openai")
      );
      expect(openaiProvider?.modelCount).toBe(2);
    });

    it("should handle file not found", async () => {
      const result = await uploadModels({
        modelsFile: "non-existent-file.json",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle invalid JSON", async () => {
      writeFileSync(testModelsFile, "{ invalid json }");

      const result = await uploadModels({
        modelsFile: testModelsFile,
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    it("should skip models without provider prefix", async () => {
      const testModels = {
        "openai/gpt-4": { model_name: "gpt-4" },
        "invalid-model": { model_name: "invalid" },
      };

      writeFileSync(testModelsFile, JSON.stringify(testModels));

      const result = await uploadModels({
        modelsFile: testModelsFile,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalModels).toBe(2);
      expect(result.data?.providerCount).toBe(1); // Only openai counted
    });
  });
});
