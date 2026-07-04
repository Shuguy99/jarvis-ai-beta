import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addNotification,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll,
  subscribe,
  evaluateRules,
  addRule,
  getRules,
  toggleRule,
  removeRule,
  type Notification,
} from "@/lib/notification-center";

// Mock crypto.randomUUID
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2) });

describe("notification-center", () => {
  beforeEach(() => {
    clearAll();
  });

  describe("addNotification / getNotifications", () => {
    it("adds a notification and returns it", () => {
      const id = addNotification({
        title: "Test",
        message: "Test message",
        type: "info",
        source: "test",
      });
      expect(id).toBeTruthy();
      const notifs = getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].title).toBe("Test");
      expect(notifs[0].read).toBe(false);
      expect(notifs[0].timestamp).toBeTruthy();
    });

    it("limits notifications to 100", () => {
      for (let i = 0; i < 110; i++) {
        addNotification({
          title: `N${i}`,
          message: `M${i}`,
          type: "info",
          source: "test",
        });
      }
      expect(getNotifications()).toHaveLength(100);
    });

    it("accepts limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        addNotification({ title: `N${i}`, message: "m", type: "info", source: "t" });
      }
      expect(getNotifications(3)).toHaveLength(3);
    });
  });

  describe("markRead / getUnreadCount / markAllRead", () => {
    it("marks a single notification as read", () => {
      const id = addNotification({ title: "T", message: "M", type: "info", source: "t" });
      expect(getUnreadCount()).toBe(1);
      markRead(id);
      expect(getUnreadCount()).toBe(0);
      expect(getNotifications()[0].read).toBe(true);
    });

    it("markRead is idempotent", () => {
      const id = addNotification({ title: "T", message: "M", type: "info", source: "t" });
      markRead(id);
      markRead(id);
      expect(getUnreadCount()).toBe(0);
    });

    it("markAllRead marks all as read", () => {
      addNotification({ title: "A", message: "M", type: "info", source: "t" });
      addNotification({ title: "B", message: "M", type: "warning", source: "t" });
      expect(getUnreadCount()).toBe(2);
      markAllRead();
      expect(getUnreadCount()).toBe(0);
    });

    it("markAllRead does not emit if nothing changed", () => {
      addNotification({ title: "T", message: "M", type: "info", source: "t" });
      markAllRead();
      let emitCount = 0;
      const unsub = subscribe(() => { emitCount++; });
      markAllRead();
      expect(emitCount).toBe(0);
      unsub();
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers on changes", () => {
      const received: Notification[][] = [];
      const unsub = subscribe((n) => received.push(n));
      addNotification({ title: "T", message: "M", type: "info", source: "t" });
      expect(received).toHaveLength(1);
      expect(received[0]).toHaveLength(1);
      unsub();
    });

    it("unsubscribes correctly", () => {
      const received: Notification[][] = [];
      const unsub = subscribe((n) => received.push(n));
      unsub();
      addNotification({ title: "T", message: "M", type: "info", source: "t" });
      expect(received).toHaveLength(0);
    });
  });

  describe("rules API", () => {
    it("getRules returns default rules on server", () => {
      // In jsdom, typeof window !== "undefined", but localStorage may work
      const rules = getRules();
      // Rules should be initialized
      expect(Array.isArray(rules)).toBe(true);
    });

    it("addRule and removeRule work", () => {
      addRule({
        name: "Test Rule",
        enabled: true,
        condition: "cpu > 50",
        type: "warning",
        message: "CPU is high",
        cooldown: 30,
      });
      const rules = getRules();
      const testRule = rules.find((r) => r.name === "Test Rule");
      expect(testRule).toBeTruthy();
      if (testRule) {
        removeRule(testRule.id);
        expect(getRules().find((r) => r.name === "Test Rule")).toBeFalsy();
      }
    });

    it("toggleRule changes enabled state", () => {
      addRule({
        name: "Toggle Test",
        enabled: true,
        condition: "cpu > 80",
        type: "critical",
        message: "CPU critical",
        cooldown: 60,
      });
      const rule = getRules().find((r) => r.name === "Toggle Test");
      expect(rule).toBeTruthy();
      if (rule) {
        toggleRule(rule.id, false);
        expect(getRules().find((r) => r.id === rule.id)?.enabled).toBe(false);
        toggleRule(rule.id, true);
        expect(getRules().find((r) => r.id === rule.id)?.enabled).toBe(true);
        removeRule(rule.id);
      }
    });
  });
});