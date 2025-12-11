import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyProjects } from "./copyProjects.js";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

// Mock Firebase Admin
vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(() => ({
      firestore: vi.fn(() => ({
        collection: vi.fn(() => ({
          get: vi.fn(() => ({
            size: 0,
            docs: [],
          })),
          doc: vi.fn(() => ({
            get: vi.fn(() => ({ exists: false })),
            set: vi.fn(() => Promise.resolve()),
          })),
        })),
      })),
      delete: vi.fn(() => Promise.resolve()),
    })),
    credential: {
      cert: vi.fn(() => ({})),
    },
  },
}));

const testSourceAccount = resolve(process.cwd(), "test-source-account.json");
const testDestAccount = resolve(process.cwd(), "test-dest-account.json");

describe("Firebase copyProjects Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create test service account files
    const serviceAccount = {
      project_id: "test-project",
      private_key: "test-key",
      client_email: "test@test.iam.gserviceaccount.com",
    };

    writeFileSync(testSourceAccount, JSON.stringify(serviceAccount));
    writeFileSync(testDestAccount, JSON.stringify(serviceAccount));
  });

  afterEach(() => {
    // Clean up test files
    try {
      unlinkSync(testSourceAccount);
      unlinkSync(testDestAccount);
    } catch (error) {
      // Ignore errors
    }
  });

  describe("copyProjects", () => {
    it("should handle dry run mode", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: testDestAccount,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
      expect(result.data?.documentsCopied).toBe(0);
    });

    it("should validate source service account exists", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: "non-existent-source.json",
        destServiceAccountPath: testDestAccount,
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Source service account not found");
    });

    it("should validate destination service account exists", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: "non-existent-dest.json",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Destination service account not found");
    });

    it("should handle specific collections", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: testDestAccount,
        collections: ["tasking", "task"],
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.collections).toEqual(["tasking", "task"]);
    });

    it("should use default collections when not specified", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: testDestAccount,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.collections).toContain("tasking");
      expect(result.data?.collections).toContain("task");
      expect(result.data?.collections).toContain("project");
    });

    it("should provide correct response structure", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: testDestAccount,
        dryRun: true,
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("message");
      expect(result.data).toHaveProperty("collectionsCopied");
      expect(result.data).toHaveProperty("documentsCopied");
      expect(result.data).toHaveProperty("userIdsReplaced");
      expect(result.data).toHaveProperty("collections");
    });

    it("should handle verbose mode", async () => {
      const result = await copyProjects({
        sourceServiceAccountPath: testSourceAccount,
        destServiceAccountPath: testDestAccount,
        verbose: true,
        dryRun: true,
      });

      expect(result.success).toBe(true);
    });
  });
});
