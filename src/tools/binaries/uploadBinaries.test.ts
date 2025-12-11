import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadBinaries } from "./uploadBinaries.js";
import { mkdirSync, writeFileSync, unlinkSync, rmdirSync } from "fs";
import { resolve, join } from "path";

// Mock Firebase
vi.mock("../../utils/firebase.js", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(),
  })),
}));

vi.mock("firebase-admin", () => ({
  default: {
    storage: vi.fn(() => ({
      bucket: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve()),
        file: vi.fn(() => ({
          makePublic: vi.fn(() => Promise.resolve()),
        })),
      })),
    })),
  },
}));

const testDistDir = resolve(process.cwd(), "test-dist");

describe("Binaries uploadBinaries Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create test directory structure
    try {
      mkdirSync(testDistDir, { recursive: true });
      mkdirSync(join(testDistDir, "mac"), { recursive: true });
      mkdirSync(join(testDistDir, "win"), { recursive: true });
      mkdirSync(join(testDistDir, "linux"), { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      rmdirSync(testDistDir, { recursive: true });
    } catch (error) {
      // Ignore errors
    }
  });

  describe("uploadBinaries", () => {
    it("should handle dry run mode", async () => {
      const result = await uploadBinaries({
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dry run");
      expect(result.data?.filesUploaded).toBe(0);
    });

    it("should handle non-existent directory", async () => {
      const result = await uploadBinaries({
        directory: "./non-existent-directory",
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Build directory not found");
    });

    it("should handle specific platform", async () => {
      // Create a test .dmg file
      const dmgFile = join(testDistDir, "mac", "TestApp.dmg");
      writeFileSync(dmgFile, "test data");

      const result = await uploadBinaries({
        platform: "mac",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBe(1);
      expect(result.data?.files[0].platform).toBe("mac");
      expect(result.data?.files[0].filename).toBe("TestApp.dmg");

      // Clean up
      unlinkSync(dmgFile);
    });

    it("should handle all platforms", async () => {
      const result = await uploadBinaries({
        platform: "all",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBeGreaterThanOrEqual(0);
    });

    it("should handle version parameter", async () => {
      const result = await uploadBinaries({
        version: "2.0.0",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
    });

    it("should provide correct response structure", async () => {
      const result = await uploadBinaries({
        directory: testDistDir,
        dryRun: true,
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("message");
      expect(result.data).toHaveProperty("filesUploaded");
      expect(result.data).toHaveProperty("totalSize");
      expect(result.data).toHaveProperty("files");
      expect(Array.isArray(result.data?.files)).toBe(true);
    });

    it("should calculate total size correctly", async () => {
      // Create test files
      const file1 = join(testDistDir, "mac", "App1.dmg");
      const file2 = join(testDistDir, "mac", "App2.dmg");
      writeFileSync(file1, "test data 1");
      writeFileSync(file2, "test data 22");

      const result = await uploadBinaries({
        platform: "mac",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBe(2);
      expect(result.data?.totalSize).toBeGreaterThan(0);

      // Clean up
      unlinkSync(file1);
      unlinkSync(file2);
    });

    it("should handle Windows platform", async () => {
      const exeFile = join(testDistDir, "win", "Setup.exe");
      writeFileSync(exeFile, "test exe data");

      const result = await uploadBinaries({
        platform: "windows",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBe(1);
      expect(result.data?.files[0].platform).toBe("windows");

      // Clean up
      unlinkSync(exeFile);
    });

    it("should handle Linux platform", async () => {
      const appImageFile = join(testDistDir, "linux", "App.AppImage");
      writeFileSync(appImageFile, "test appimage data");

      const result = await uploadBinaries({
        platform: "linux",
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBe(1);
      expect(result.data?.files[0].platform).toBe("linux");

      // Clean up
      unlinkSync(appImageFile);
    });

    it("should handle empty platform directories", async () => {
      const result = await uploadBinaries({
        directory: testDistDir,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.filesUploaded).toBe(0);
      expect(result.data?.totalSize).toBe(0);
    });
  });
});
