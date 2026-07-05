/**
 * Multi-User Profile System for JARVIS
 * Each user has their own settings, conversations, and preferences
 */

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;           // emoji avatar
  color: string;            // accent color hex
  createdAt: string;
  lastActiveAt: string;
  settings: {
    ttsRate: number;
    ttsPitch: number;
    volume: number;
    autoSpeak: boolean;
    language: string;
    userName: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    customPrompt: string;
    personaId: string;
  };
}

const STORAGE_KEY = "jarvis-user-profiles";
const ACTIVE_KEY = "jarvis-active-user";

function loadProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProfiles(profiles: UserProfile[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
}

export function getDefaultProfile(): UserProfile {
  return {
    id: "default",
    name: "Пользователь",
    avatar: "👤",
    color: "#00d4ff",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    settings: {
      ttsRate: 1.05,
      ttsPitch: 0.95,
      volume: 1.0,
      autoSpeak: true,
      language: "ru",
      userName: "сэр",
      temperature: 0.7,
      maxTokens: 2048,
      contextWindow: 10,
      customPrompt: "",
      personaId: "classic",
    },
  };
}

export function getProfiles(): UserProfile[] {
  const profiles = loadProfiles();
  if (profiles.length === 0) {
    const defaultProfile = getDefaultProfile();
    saveProfiles([defaultProfile]);
    return [defaultProfile];
  }
  return profiles;
}

export function getActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "default";
}

export function setActiveProfileId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveProfile(): UserProfile {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  return profiles.find(p => p.id === activeId) ?? profiles[0];
}

export function createProfile(name: string, avatar: string, color: string): UserProfile {
  const profiles = getProfiles();
  const newProfile: UserProfile = {
    id: `user_${Date.now()}`,
    name,
    avatar,
    color,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    settings: { ...getDefaultProfile().settings },
  };
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}

export function updateProfile(id: string, patch: Partial<UserProfile>) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === id);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], ...patch, lastActiveAt: new Date().toISOString() };
  saveProfiles(profiles);
}

export function deleteProfile(id: string) {
  const profiles = getProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  if (filtered.length === 0) return; // can't delete last profile
  saveProfiles(filtered);
  if (getActiveProfileId() === id) {
    setActiveProfileId(filtered[0].id);
  }
}

export const AVATAR_OPTIONS = ["👤", "🧑‍💻", "👨‍🔬", "👩‍🎨", "🦸", "🧙", "🤖", "👽", "🎭", "🎯"];
export const COLOR_OPTIONS = ["#00d4ff", "#ff6b35", "#9b59b6", "#2ecc71", "#e74c3c", "#f39c12", "#1abc9c", "#3498db"];