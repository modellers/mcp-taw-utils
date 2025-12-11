import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseGitUri } from "./collection.js";

describe("Config Collection Tools", () => {
  describe("parseGitUri", () => {
    it("should parse HTTPS GitHub URL", () => {
      const result = parseGitUri("https://github.com/owner/repo.git");

      expect(result.uri).toBe("https://github.com/owner/repo.git");
      expect(result.type).toBe("git");
      expect(result.protocol).toBe("https");
      expect(result.host).toBe("github.com");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
      expect(result.path).toBe("owner/repo");
    });

    it("should parse HTTPS GitHub URL without .git", () => {
      const result = parseGitUri("https://github.com/owner/repo");

      expect(result.protocol).toBe("https");
      expect(result.host).toBe("github.com");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("should parse SSH GitHub URL", () => {
      const result = parseGitUri("git@github.com:owner/repo.git");

      expect(result.protocol).toBe("ssh");
      expect(result.host).toBe("github.com");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("should parse bare GitHub URL", () => {
      const result = parseGitUri("github.com/owner/repo");

      expect(result.protocol).toBe("https");
      expect(result.host).toBe("github.com");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("should include timestamp", () => {
      const result = parseGitUri("https://github.com/owner/repo");

      expect(result.parsedAt).toBeDefined();
      expect(new Date(result.parsedAt).getTime()).toBeGreaterThan(0);
    });

    it("should handle complex paths", () => {
      const result = parseGitUri("https://github.com/owner/repo-name.git");

      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo-name");
    });
  });
});
