// ============================================================
// JARVIS Store — Serializable state via Zustand
// Extracted from use-jarvis.ts so the hook becomes a thin
// browser-API controller.
// ============================================================

import { create } from "zustand";
import type { ChatMessage, Conversation } from "@/lib/types";
import type { TaskPlan } from "@/lib/task-planner";

// ── Shared types (imported by use-jarvis.ts and page.tsx) ─────

export type JarvisState = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface Source {
  name: string;
  url: string;
  host_name?: string;
}

export interface JarvisSettings {
  ttsRate: number;
  ttsPitch: number;
  volume: number;
  autoSpeak: boolean;
  language: string;
  persona: string;
  userName: string;
  formality: number;
  humor: number;
  responseStyle: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  customPrompt: string;
}

export interface CommandHandlers {
  startTimer?: (seconds: number) => void;
  stopTimer?: () => void;
  resetTimer?: () => void;
  toggleNotes?: () => void;
  openNotes?: () => void;
  setTheme?: (theme: string) => void;
  toggleFullscreen?: () => void;
  openSettings?: () => void;
  toggleCalculator?: () => void;
  captureScreen?: () => void;
}

// ── Shared defaults & helpers ────────────────────────────────

export const DEFAULT_SETTINGS: JarvisSettings = {
  ttsRate: 1.05,
  ttsPitch: 0.95,
  volume: 1.0,
  autoSpeak: true,
  language: "ru",
  persona: "classic",
  userName: "сэр",
  formality: 0.5,
  humor: 0.3,
  responseStyle: "standard",
  temperature: 0.7,
  maxTokens: 2048,
  contextWindow: 10,
  customPrompt: "",
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const trunc = (s: string, max = 40) =>
  s.length > max ? s.slice(0, max) + "..." : s;

// ── Store state & actions ────────────────────────────────────

export interface JarvisStoreState {
  messages: ChatMessage[];
  jarvisState: JarvisState;
  error: string | null;
  autoSpeakOn: boolean;
  searchedSources: Source[] | null;
  conversations: Conversation[];
  activeConvoId: string | null;
  isRecording: boolean;
  audioLevel: number;
  continuousMode: boolean;
  taskPlan: TaskPlan | null;
}

export interface JarvisStoreActions {
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  setJarvisState: (s: JarvisState | ((prev: JarvisState) => JarvisState)) => void;
  setError: (e: string | null) => void;
  setAutoSpeakOn: (v: boolean | ((prev: boolean) => boolean)) => void;
  setSearchedSources: (s: Source[] | null) => void;
  setActiveConvoId: (id: string | null) => void;
  setConversations: (cs: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  addConversation: (c: Conversation) => void;
  removeConversation: (id: string) => void;
  setIsRecording: (v: boolean) => void;
  setAudioLevel: (v: number | ((prev: number) => number)) => void;
  setContinuousMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  setTaskPlan: (plan: TaskPlan | null) => void;
  clearChat: () => void;
  resetToIdle: () => void;
}

// ── Helper (same pattern as ui-store.ts) ─────────────────────

function apply<T>(v: T | ((prev: T) => T), prev: T): T {
  return typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
}

// ── Store ────────────────────────────────────────────────────

export const useJarvisStore = create<JarvisStoreState & JarvisStoreActions>()(
  (set) => ({
    // State
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
    taskPlan: null,

    // Core chat
    addMessage: (msg) =>
      set((s) => ({ messages: [...s.messages, msg] })),

    updateMessage: (id, patch) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      })),

    setMessages: (msgs) =>
      set((s) => ({ messages: apply(msgs, s.messages) })),

    setJarvisState: (s) =>
      set((state) => ({ jarvisState: apply(s, state.jarvisState) })),

    setError: (e) => set({ error: e }),

    setAutoSpeakOn: (v) =>
      set((s) => ({ autoSpeakOn: apply(v, s.autoSpeakOn) })),

    setSearchedSources: (s) => set({ searchedSources: s }),

    // Conversations
    setActiveConvoId: (id) => set({ activeConvoId: id }),

    setConversations: (cs) =>
      set((s) => ({ conversations: apply(cs, s.conversations) })),

    addConversation: (c) =>
      set((s) => ({ conversations: [...s.conversations, c] })),

    removeConversation: (id) =>
      set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),

    // Voice
    setIsRecording: (v) => set({ isRecording: v }),

    setAudioLevel: (v) =>
      set((s) => ({ audioLevel: apply(v, s.audioLevel) })),

    setContinuousMode: (v) =>
      set((s) => ({ continuousMode: apply(v, s.continuousMode) })),

    setTaskPlan: (plan) => set({ taskPlan: plan }),

    // Convenience
    clearChat: () =>
      set({
        messages: [],
        searchedSources: null,
        error: null,
        jarvisState: "idle",
      }),

    resetToIdle: () => set({ jarvisState: "idle" }),
  }),
);