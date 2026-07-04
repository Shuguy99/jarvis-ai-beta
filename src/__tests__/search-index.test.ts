import { describe, it, expect, beforeEach } from "vitest";
import {
  addToIndex,
  addMessages,
  addConversations,
  search,
  clearIndex,
  SEARCH_CATEGORIES,
} from "@/lib/search-index";

describe("search-index", () => {
  beforeEach(() => {
    clearIndex();
  });

  describe("addToIndex", () => {
    it("adds an item and returns an id", () => {
      const id = addToIndex("command", {
        type: "command",
        title: "New Conversation",
        description: "Start a new chat",
        icon: "Command",
        category: "Chat",
      });
      expect(id).toBeTruthy();
    });
  });

  describe("search", () => {
    it("returns empty for empty query", () => {
      addToIndex("command", {
        type: "command",
        title: "Test",
        icon: "Command",
        category: "C",
      });
      expect(search("")).toHaveLength(0);
      expect(search("   ")).toHaveLength(0);
    });

    it("finds by exact title match", () => {
      addToIndex("command", {
        type: "command",
        title: "Fullscreen",
        icon: "Command",
        category: "View",
      });
      const results = search("Fullscreen");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Fullscreen");
    });

    it("finds by partial title match", () => {
      addToIndex("command", {
        type: "command",
        title: "Voice Input",
        icon: "Command",
        category: "Voice",
      });
      const results = search("voice");
      expect(results).toHaveLength(1);
    });

    it("finds by description", () => {
      addToIndex("command", {
        type: "command",
        title: "Settings",
        description: "Open the configuration panel",
        icon: "Command",
        category: "System",
      });
      const results = search("configuration");
      expect(results).toHaveLength(1);
    });

    it("rejects if any word is not found", () => {
      addToIndex("command", {
        type: "command",
        title: "New Conversation",
        icon: "Command",
        category: "Chat",
      });
      // "conversation" matches, "banana" doesn't → rejected
      const results = search("conversation banana");
      expect(results).toHaveLength(0);
    });

    it("ranks exact title match higher than partial", () => {
      addToIndex("command", {
        type: "command",
        title: "Test",
        icon: "Command",
        category: "A",
      });
      addToIndex("command", {
        type: "command",
        title: "Test Settings",
        icon: "Command",
        category: "B",
      });
      const results = search("Test");
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Test");
      expect(results[0].relevance).toBeGreaterThan(results[1].relevance);
    });

    it("filters by type", () => {
      addToIndex("command", {
        type: "command",
        title: "Voice",
        icon: "Command",
        category: "Voice",
      });
      addToIndex("setting", {
        type: "setting",
        title: "Voice Settings",
        icon: "Settings",
        category: "Settings",
      });
      const results = search("Voice", { types: ["command"] });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("command");
    });

    it("respects limit option", () => {
      for (let i = 0; i < 10; i++) {
        addToIndex("command", {
          type: "command",
          title: `Test Item ${i}`,
          description: "test desc",
          icon: "Command",
          category: "C",
        });
      }
      const results = search("Test");
      expect(results.length).toBeLessThanOrEqual(10);
      expect(search("Test", { limit: 3 })).toHaveLength(3);
    });
  });

  describe("addMessages", () => {
    it("indexes messages with user/bot prefix", () => {
      addMessages([
        { id: "m1", content: "Hello JARVIS", role: "user", createdAt: "2025-01-01T00:00:00Z" },
        { id: "m2", content: "Hello sir", role: "assistant", createdAt: "2025-01-01T00:01:00Z" },
      ]);
      const results = search("Hello");
      expect(results).toHaveLength(2);
    });
  });

  describe("addConversations", () => {
    it("indexes conversations by title", () => {
      addConversations([
        { id: "c1", title: "Project Planning", updatedAt: "2025-01-01T00:00:00Z" },
      ]);
      const results = search("Planning");
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("conversation");
    });
  });

  describe("SEARCH_CATEGORIES", () => {
    it("has expected categories", () => {
      const ids = SEARCH_CATEGORIES.map((c) => c.id);
      expect(ids).toContain("all");
      expect(ids).toContain("commands");
      expect(ids).toContain("messages");
      expect(ids).toContain("files");
      expect(ids).toContain("settings");
    });

    it("'all' category includes all types", () => {
      const all = SEARCH_CATEGORIES.find((c) => c.id === "all");
      expect(all).toBeTruthy();
      expect(all!.types).toHaveLength(6);
    });
  });
});