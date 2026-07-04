import { describe, it, expect, beforeEach } from "vitest";
import { useJarvisStore, DEFAULT_SETTINGS, uid, trunc } from "@/lib/jarvis-store";
import { useUIStore } from "@/lib/ui-store";

// ── jarvis-store ──────────────────────────────────────────────

describe("jarvis-store", () => {
  beforeEach(() => {
    useJarvisStore.setState({
      messages: [],
      jarvisState: "idle",
      error: null,
      autoSpeakOn: true,
      searchedSources: null,
      conversations: [],
      activeConvoId: null,
      isRecording: false,
      audioLevel: 0,
      continuousMode: false,
    });
  });

  describe("helpers", () => {
    it("uid returns a non-empty string", () => {
      const id = uid();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("uid returns different values on each call (high probability)", () => {
      const ids = new Set(Array.from({ length: 20 }, () => uid()));
      expect(ids.size).toBeGreaterThan(18); // allow small collision chance
    });

    it("trunc returns original when under max", () => {
      expect(trunc("hello")).toBe("hello");
      expect(trunc("hello", 10)).toBe("hello");
    });

    it("trunc adds ellipsis when over max", () => {
      expect(trunc("abcdefghij", 5)).toBe("abcde...");
      expect(trunc("abcdefghij", 10)).toBe("abcdefghij");
    });

    it("DEFAULT_SETTINGS has expected shape", () => {
      expect(DEFAULT_SETTINGS.ttsRate).toBe(1.05);
      expect(DEFAULT_SETTINGS.volume).toBe(1.0);
      expect(DEFAULT_SETTINGS.language).toBe("ru");
      expect(DEFAULT_SETTINGS.temperature).toBe(0.7);
    });
  });

  describe("messages", () => {
    it("addMessage appends to messages array", () => {
      useJarvisStore.getState().addMessage({
        id: "m1", role: "user", content: "Hello", createdAt: new Date().toISOString(),
      });
      expect(useJarvisStore.getState().messages).toHaveLength(1);
      expect(useJarvisStore.getState().messages[0].content).toBe("Hello");
    });

    it("updateMessage patches existing message", () => {
      useJarvisStore.getState().addMessage({
        id: "m1", role: "user", content: "Hello", createdAt: new Date().toISOString(),
      });
      useJarvisStore.getState().updateMessage("m1", { content: "Updated" });
      expect(useJarvisStore.getState().messages[0].content).toBe("Updated");
    });

    it("setMessages replaces all messages", () => {
      useJarvisStore.getState().addMessage({
        id: "m1", role: "user", content: "A", createdAt: new Date().toISOString(),
      });
      useJarvisStore.getState().setMessages([
        { id: "m2", role: "assistant", content: "B", createdAt: new Date().toISOString() },
      ]);
      expect(useJarvisStore.getState().messages).toHaveLength(1);
      expect(useJarvisStore.getState().messages[0].content).toBe("B");
    });

    it("setMessages accepts updater function", () => {
      useJarvisStore.getState().addMessage({
        id: "m1", role: "user", content: "A", createdAt: new Date().toISOString(),
      });
      useJarvisStore.getState().setMessages((prev) => [
        ...prev,
        { id: "m2", role: "assistant", content: "B", createdAt: new Date().toISOString() },
      ]);
      expect(useJarvisStore.getState().messages).toHaveLength(2);
    });
  });

  describe("jarvisState", () => {
    it("setJarvisState updates state directly", () => {
      useJarvisStore.getState().setJarvisState("thinking");
      expect(useJarvisStore.getState().jarvisState).toBe("thinking");
    });

    it("setJarvisState accepts updater function", () => {
      useJarvisStore.getState().setJarvisState("listening");
      useJarvisStore.getState().setJarvisState((prev) =>
        prev === "listening" ? "thinking" : prev,
      );
      expect(useJarvisStore.getState().jarvisState).toBe("thinking");
    });
  });

  describe("conversations", () => {
    it("addConversation and setActiveConvoId", () => {
      useJarvisStore.getState().addConversation({
        id: "c1", title: "Test", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      expect(useJarvisStore.getState().conversations).toHaveLength(1);
      useJarvisStore.getState().setActiveConvoId("c1");
      expect(useJarvisStore.getState().activeConvoId).toBe("c1");
    });

    it("removeConversation removes by id", () => {
      useJarvisStore.getState().addConversation({
        id: "c1", title: "A", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      useJarvisStore.getState().addConversation({
        id: "c2", title: "B", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      useJarvisStore.getState().removeConversation("c1");
      expect(useJarvisStore.getState().conversations).toHaveLength(1);
      expect(useJarvisStore.getState().conversations[0].id).toBe("c2");
    });
  });

  describe("convenience", () => {
    it("clearChat resets messages, sources, error, state", () => {
      useJarvisStore.setState({
        messages: [{ id: "m1", role: "user", content: "x", createdAt: "" }],
        error: "some error",
        jarvisState: "thinking",
        searchedSources: [{ name: "src", url: "http://x" }],
      });
      useJarvisStore.getState().clearChat();
      const s = useJarvisStore.getState();
      expect(s.messages).toHaveLength(0);
      expect(s.error).toBeNull();
      expect(s.jarvisState).toBe("idle");
      expect(s.searchedSources).toBeNull();
    });

    it("resetToIdle only resets jarvisState", () => {
      useJarvisStore.setState({ jarvisState: "speaking", error: "err" });
      useJarvisStore.getState().resetToIdle();
      const s = useJarvisStore.getState();
      expect(s.jarvisState).toBe("idle");
      expect(s.error).toBe("err"); // untouched
    });
  });
});

// ── ui-store ──────────────────────────────────────────────────

describe("ui-store", () => {
  beforeEach(() => {
    useUIStore.getState().closeAllPanels();
    useUIStore.setState({
      booted: false,
      timerVisible: true,
      dndMode: false,
    });
  });

  describe("panel toggles", () => {
    it("toggleNotes toggles notesOpen", () => {
      expect(useUIStore.getState().notesOpen).toBe(false);
      useUIStore.getState().toggleNotes();
      expect(useUIStore.getState().notesOpen).toBe(true);
      useUIStore.getState().toggleNotes();
      expect(useUIStore.getState().notesOpen).toBe(false);
    });

    it("toggleTimer toggles timerVisible", () => {
      expect(useUIStore.getState().timerVisible).toBe(true);
      useUIStore.getState().toggleTimer();
      expect(useUIStore.getState().timerVisible).toBe(false);
    });

    it("toggleDnd toggles dndMode", () => {
      expect(useUIStore.getState().dndMode).toBe(false);
      useUIStore.getState().toggleDnd();
      expect(useUIStore.getState().dndMode).toBe(true);
    });
  });

  describe("setters with updater function", () => {
    it("setNotesOpen with function", () => {
      useUIStore.getState().setNotesOpen((prev) => !prev);
      expect(useUIStore.getState().notesOpen).toBe(true);
    });

    it("setDndMode with function", () => {
      useUIStore.getState().setDndMode((prev) => !prev);
      expect(useUIStore.getState().dndMode).toBe(true);
    });
  });

  describe("closeAllPanels", () => {
    it("closes all panel flags", () => {
      useUIStore.setState({
        paletteOpen: true,
        settingsOpen: true,
        notesOpen: true,
        markdownOpen: true,
        agentOpen: true,
        pluginOpen: true,
        layoutOpen: true,
        notifOpen: true,
      });
      useUIStore.getState().closeAllPanels();
      const s = useUIStore.getState();
      expect(s.paletteOpen).toBe(false);
      expect(s.settingsOpen).toBe(false);
      expect(s.notesOpen).toBe(false);
      expect(s.markdownOpen).toBe(false);
      expect(s.agentOpen).toBe(false);
      expect(s.pluginOpen).toBe(false);
      expect(s.layoutOpen).toBe(false);
      expect(s.notifOpen).toBe(false);
    });
  });

  describe("widget IDs", () => {
    it("has default left and right widget arrays", () => {
      const s = useUIStore.getState();
      expect(s.leftWidgetIds.length).toBeGreaterThan(0);
      expect(s.rightWidgetIds.length).toBeGreaterThan(0);
    });

    it("setLeftWidgetIds replaces left widgets", () => {
      useUIStore.getState().setLeftWidgetIds(["custom-1", "custom-2"]);
      expect(useUIStore.getState().leftWidgetIds).toEqual(["custom-1", "custom-2"]);
    });

    it("setRightWidgetIds accepts updater", () => {
      useUIStore.getState().setRightWidgetIds((prev) => [...prev, "new-widget"]);
      const updated = useUIStore.getState().rightWidgetIds;
      expect(updated[updated.length - 1]).toBe("new-widget");
    });
  });
});