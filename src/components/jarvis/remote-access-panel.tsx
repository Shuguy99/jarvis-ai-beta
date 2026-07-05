"use client";

// JARVIS Remote Access Panel — manage remote control sessions

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Smartphone,
  Copy,
  Trash2,
  Shield,
  Clock,
  Plus,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  type RemoteSession,
  type RemoteSessionPermissions,
  getSessions,
  createSession,
  revokeSession,
  updateSessionPermissions,
} from "@/lib/remote-access";

// ─── Helpers ─────────────────────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function formatCountdown(lastActive: number): string {
  const remaining = SESSION_TTL_MS - (Date.now() - lastActive);
  if (remaining <= 0) return "expired";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((remaining % 60_000) / 1_000);
  return `${m}m ${s}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function deviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d.includes("phone") || d.includes("mobile")) return <Smartphone className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

// ─── Permission Toggle ───────────────────────────────────────────────

function PermToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition"
      style={{
        borderColor: enabled ? "var(--primary)" : "rgba(255,255,255,0.08)",
        backgroundColor: enabled ? "rgba(var(--primary),0.12)" : "transparent",
        color: enabled ? "var(--primary)" : "var(--muted-foreground)",
      }}
    >
      {enabled && <Shield className="h-2.5 w-2.5" />}
      {label}
    </button>
  );
}

// ─── Session Row ─────────────────────────────────────────────────────

function SessionRow({
  session,
  onRevoke,
  onPermChange,
}: {
  session: RemoteSession;
  onRevoke: (id: string) => void;
  onPermChange: (id: string, perm: keyof RemoteSessionPermissions) => void;
}) {
  const [countdown, setCountdown] = useState(formatCountdown(session.lastActive));

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(formatCountdown(session.lastActive));
    }, 1_000);
    return () => clearInterval(id);
  }, [session.lastActive]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group rounded-lg border jarvis-border-cyan bg-card/30 p-2.5 transition hover:bg-card/60"
    >
      {/* Top row: device info + actions */}
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 text-primary/60">{deviceIcon(session.device)}</div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-[10px] font-semibold text-foreground">
              {session.name}
            </span>
            <span className="flex-shrink-0 font-mono text-[8px] text-muted-foreground/50">
              {session.device}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
            <span className="font-mono text-[9px] text-muted-foreground">
              {formatTime(session.createdAt)}
            </span>
            <span className="font-mono text-[9px] text-primary/60">
              TTL {countdown}
            </span>
          </div>
        </div>

        <button
          onClick={() => { onRevoke(session.id); playSound("deactivate"); }}
          className="rounded p-0.5 text-muted-foreground/30 transition hover:text-destructive opacity-0 group-hover:opacity-100"
          title="Revoke session"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Permissions row */}
      <div className="mt-2 flex items-center gap-1.5">
        <PermToggle
          label="Chat"
          enabled={session.permissions.chat}
          onToggle={() => onPermChange(session.id, "chat")}
        />
        <PermToggle
          label="Voice"
          enabled={session.permissions.voice}
          onToggle={() => onPermChange(session.id, "voice")}
        />
        <PermToggle
          label="Settings"
          enabled={session.permissions.settings}
          onToggle={() => onPermChange(session.id, "settings")}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────

export function RemoteAccessPanel() {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionDevice, setNewSessionDevice] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30s to prune expired sessions
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleCreate = () => {
    const name = newSessionName.trim() || "Remote User";
    const device = newSessionDevice.trim() || "Unknown Device";
    const session = createSession(name, device);
    setGeneratedCode(session.accessCode);
    setNewSessionName("");
    setNewSessionDevice("");
    setShowNewForm(false);
    playSound("activate");
    refresh();
  };

  const handleRevoke = (id: string) => {
    revokeSession(id);
    refresh();
  };

  const handlePermChange = (id: string, perm: keyof RemoteSessionPermissions) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    updateSessionPermissions(id, { [perm]: !session.permissions[perm] });
    playSound("click");
    refresh();
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      playSound("data-received");
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Remote Access
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { refresh(); playSound("click"); }}
            className="rounded-md border jarvis-border-cyan p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setShowNewForm(!showNewForm); playSound("click"); }}
            className="rounded-md border jarvis-border-cyan p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            title="New Session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Generated code display */}
      <AnimatePresence>
        {generatedCode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                Access Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary jarvis-glow">
                  {generatedCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="rounded-md border border-primary/30 p-1.5 text-primary/70 transition hover:bg-primary/10 hover:text-primary"
                  title="Copy code"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {copied && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-1 font-mono text-[9px] text-primary"
                >
                  Copied to clipboard
                </motion.p>
              )}
              <button
                onClick={() => setGeneratedCode(null)}
                className="mt-2 font-mono text-[9px] text-muted-foreground/50 transition hover:text-muted-foreground"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New session form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t jarvis-border-cyan pt-3">
              <input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Session name"
                className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
                autoFocus
              />
              <input
                value={newSessionDevice}
                onChange={(e) => setNewSessionDevice(e.target.value)}
                placeholder="Device identifier (e.g. iPhone 15)"
                className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
                >
                  Generate Code
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="rounded-md border border-muted-foreground/20 bg-transparent px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sessions list */}
      <div className="space-y-1.5 jarvis-scroll max-h-[300px] overflow-y-auto">
        {sessions.length === 0 && !showNewForm && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Wifi className="h-6 w-6 text-muted-foreground/20" />
            <p className="font-mono text-[10px] text-muted-foreground">
              No active sessions. Press + to create one.
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onRevoke={handleRevoke}
              onPermChange={handlePermChange}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}