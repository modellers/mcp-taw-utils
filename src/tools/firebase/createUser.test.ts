import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUser } from "./createUser.js";
import admin from "firebase-admin";

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

vi.mock("firebase-admin", () => ({
  default: {
    auth: vi.fn(() => ({
      createUser: vi.fn(),
    })),
    firestore: {
      Timestamp: {
        now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
      },
    },
  },
}));

describe("Firebase createUser Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("should handle dry run mode", async () => {
      const result = await createUser({
        email: "test@example.com",
        password: "password123",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
      expect(result.data?.userId).toBe("dry-run-user-id");
      expect(result.message).toContain("Dry run");
    });

    it("should validate password length", async () => {
      const result = await createUser({
        email: "test@example.com",
        password: "12345", // Only 5 characters
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 6 characters");
    });

    it("should create user with valid credentials in dry run", async () => {
      const result = await createUser({
        email: "user@example.com",
        password: "validPassword123",
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.email).toBe("user@example.com");
      expect(result.data?.profileCreated).toBe(false);
      expect(result.data?.actorCreated).toBe(false);
    });

    it("should handle email validation", async () => {
      const result = await createUser({
        email: "invalid-email",
        password: "password123",
        dryRun: true,
      });

      // In dry run, email validation is not enforced
      expect(result.success).toBe(true);
    });

    it("should provide correct response structure", async () => {
      const result = await createUser({
        email: "test@example.com",
        password: "password123",
        dryRun: true,
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("message");
      expect(result.data).toHaveProperty("userId");
      expect(result.data).toHaveProperty("email");
      expect(result.data).toHaveProperty("profileCreated");
      expect(result.data).toHaveProperty("actorCreated");
    });

    it("should handle different email formats", async () => {
      const emails = [
        "test@example.com",
        "user+tag@example.co.uk",
        "admin@subdomain.example.com",
      ];

      for (const email of emails) {
        const result = await createUser({
          email,
          password: "password123",
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.data?.email).toBe(email);
      }
    });

    it("should handle minimum password length", async () => {
      const result = await createUser({
        email: "test@example.com",
        password: "123456", // Exactly 6 characters
        dryRun: true,
      });

      expect(result.success).toBe(true);
    });
  });
});
