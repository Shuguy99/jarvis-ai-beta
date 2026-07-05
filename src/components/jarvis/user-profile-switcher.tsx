import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Trash2, Check } from "lucide-react";
import {
  getProfiles, getActiveProfile, setActiveProfileId,
  createProfile, deleteProfile, updateProfile,
  AVATAR_OPTIONS, COLOR_OPTIONS,
  type UserProfile,
} from "@/lib/user-profiles";
import { playSound } from "@/lib/sounds";

export function UserProfileSwitcher() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("👤");
  const [newColor, setNewColor] = useState("#00d4ff");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    const ps = getProfiles();
    setProfiles(ps);
    const active = getActiveProfile();
    setActiveId(active.id);
  }

  function switchProfile(id: string) {
    playSound("click");
    setActiveProfileId(id);
    setActiveId(id);
    updateProfile(id, { lastActiveAt: new Date().toISOString() });
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent("jarvis-profile-switch", { detail: { profileId: id } }));
  }

  function handleCreate() {
    if (!newName.trim()) return;
    playSound("success");
    createProfile(newName.trim(), newAvatar, newColor);
    setNewName("");
    setNewAvatar("👤");
    setNewColor("#00d4ff");
    setShowCreate(false);
    refresh();
  }

  function handleDelete(id: string) {
    if (profiles.length <= 1) return;
    playSound("deactivate");
    deleteProfile(id);
    refresh();
  }

  const active = profiles.find(p => p.id === activeId);

  return (
    <div className="space-y-2">
      {/* Active Profile Badge */}
      {active && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="text-lg">{active.avatar}</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-wider text-primary truncate">{active.name}</div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {new Date(active.lastActiveAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      <div className="space-y-1">
        {profiles.map(p => (
          <div
            key={p.id}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition cursor-pointer ${
              p.id === activeId ? "bg-primary/10 border border-primary/30" : "hover:bg-primary/5 border border-transparent"
            }`}
            onClick={() => p.id !== activeId && switchProfile(p.id)}
          >
            <span className="text-sm" style={{ filter: p.id === activeId ? "none" : "grayscale(0.5)" }}>{p.avatar}</span>
            <span className={`flex-1 font-mono text-[10px] truncate ${p.id === activeId ? "text-primary" : "text-muted-foreground"}`}>
              {p.name}
            </span>
            {p.id === activeId && <Check className="h-3 w-3 text-primary" />}
            {profiles.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                className="opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create New */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2 rounded-lg border border-primary/20 bg-card/50 p-2"
          >
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Имя профиля..."
              className="w-full rounded border border-primary/20 bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <div className="flex flex-wrap gap-1">
              {AVATAR_OPTIONS.map(a => (
                <button
                  key={a}
                  onClick={() => setNewAvatar(a)}
                  className={`h-6 w-6 rounded text-sm flex items-center justify-center border transition ${
                    a === newAvatar ? "border-primary bg-primary/20" : "border-transparent hover:bg-primary/10"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-4 w-4 rounded-full border-2 transition ${
                    c === newColor ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded border border-primary/20 py-1 font-mono text-[9px] text-muted-foreground hover:bg-primary/5"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 rounded border border-primary/30 bg-primary/10 py-1 font-mono text-[9px] text-primary hover:bg-primary/20 disabled:opacity-40"
              >
                Создать
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/20 py-1.5 font-mono text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <UserPlus className="h-3 w-3" />
          <span>Новый профиль</span>
        </button>
      )}
    </div>
  );
}