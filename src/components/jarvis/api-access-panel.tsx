import { useCallback, useEffect, useState } from "react";
import {
  Key,
  Copy,
  RefreshCw,
  Activity,
  Shield,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser, logout, registerUser, loginUser, getOAuthConfig, type AuthUser } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────

interface ApiStatus {
  online: boolean;
  provider: string;
  requestsToday: number;
}

// ─── API Access Panel ─────────────────────────────────────────────

export function ApiAccessPanel() {
  const [status, setStatus] = useState<ApiStatus>({ online: false, provider: "—", requestsToday: 0 });
  const [token, setToken] = useState<string>("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/public/status");
      const data = await res.json();
      setStatus({
        online: data.status === "online",
        provider: data.provider ?? "—",
        requestsToday: data.requestsToday ?? 0,
      });
    } catch {
      setStatus((s) => ({ ...s, online: false }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Load token from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jarvis-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.accessToken ?? "");
      }
    } catch { /* ignore */ }
  }, []);

  const handleCopy = useCallback(() => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    try {
      const user = getCurrentUser();
      if (!user) return;
      const config = getOAuthConfig();
      const { generateToken, generateRefreshToken } = await import("@/lib/auth");
      const newAccessToken = await generateToken(user.id, config.jwtSecret, user.email, user.role);
      const refreshToken = generateRefreshToken();
      const newToken = {
        accessToken: newAccessToken,
        refreshToken,
        expiresAt: Date.now() + config.tokenExpiryHours * 3600 * 1000,
        userId: user.id,
      };
      localStorage.setItem("jarvis-auth-token", JSON.stringify(newToken));
      setToken(newAccessToken);
    } finally {
      setLoading(false);
    }
  }, []);

  const maskedToken = token
    ? token.slice(0, 12) + "••••••••••••••••" + token.slice(-8)
    : "No token generated";

  const endpoints = [
    { method: "GET", path: "/api/jarvis/public", desc: "API info" },
    { method: "GET", path: "/api/jarvis/public/status", desc: "System status" },
    { method: "POST", path: "/api/jarvis/public/chat", desc: "Send message" },
    { method: "POST", path: "/api/jarvis/public/voice", desc: "Text-to-speech" },
    { method: "GET", path: "/api/jarvis/public/conversations", desc: "Conversations" },
  ];

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-3 rounded-lg border jarvis-border-cyan bg-muted/20 p-3">
        <div className={`h-2.5 w-2.5 rounded-full ${status.online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-red-500"}`} />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/90">
            API Status
          </div>
          <div className="font-mono text-[9px] text-muted-foreground/60">
            {status.online ? `Online — ${status.provider}` : "Offline"}
          </div>
        </div>
      </div>

      {/* Token Display */}
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground/80">
          API Token
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border jarvis-border-cyan bg-muted/30 px-3 py-2 font-mono text-[11px] text-primary/90 select-all">
            {tokenVisible ? token : maskedToken}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!token}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            title="Copy token"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTokenVisible((v) => !v)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            title={tokenVisible ? "Hide token" : "Show token"}
          >
            <Key className="h-3.5 w-3.5" />
          </Button>
        </div>
        {copied && (
          <div className="mt-1 font-mono text-[9px] text-emerald-400">✓ Copied to clipboard</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={!token || loading}
          className="gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            setToken("");
          }}
          disabled={!token}
          className="gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Revoke
        </Button>
      </div>

      {/* Rate Limit Info */}
      <div className="rounded-lg border jarvis-border-cyan/50 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
            Rate Limits
          </span>
        </div>
        <div className="space-y-1 font-mono text-[9px] text-muted-foreground/60">
          <div className="flex justify-between">
            <span>Requests / minute</span>
            <span className="text-primary/80">60</span>
          </div>
          <div className="flex justify-between">
            <span>Requests today</span>
            <span className="text-primary/80">{status.requestsToday}</span>
          </div>
          <div className="flex justify-between">
            <span>Auth method</span>
            <span className="text-primary/80">Bearer Token</span>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <ExternalLink className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
            Endpoints
          </span>
        </div>
        <div className="space-y-1">
          {endpoints.map((ep) => (
            <div
              key={ep.path}
              className="flex items-center gap-2 rounded-md border border-muted/20 bg-muted/10 px-2.5 py-1.5"
            >
              <span className="min-w-[32px] rounded bg-primary/10 px-1.5 py-0.5 text-center font-mono text-[8px] font-semibold uppercase text-primary">
                {ep.method}
              </span>
              <span className="flex-1 font-mono text-[9px] text-foreground/70">{ep.path}</span>
              <span className="font-mono text-[8px] text-muted-foreground/50">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Example */}
      <div className="rounded-lg border border-dashed jarvis-border-cyan/30 bg-muted/5 p-3">
        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
          Example
        </div>
        <pre className="overflow-x-auto font-mono text-[9px] text-primary/70">
{`curl -H "Authorization: Bearer TOKEN" \\
  -d '{"message":"Hello"}' \\
  /api/jarvis/public/chat`}
        </pre>
      </div>
    </div>
  );
}

// ─── Auth Section (login/register) ────────────────────────────────

export function AuthSection() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (u) setUser(u);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/jarvis/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Auth failed");
        return;
      }
      // Store token locally
      localStorage.setItem(
        "jarvis-auth-token",
        JSON.stringify({
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
        }),
      );
      setUser({
        id: "",
        email,
        name: name || email.split("@")[0],
        provider: "local",
        role: "admin",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name]);

  const handleLogout = useCallback(() => {
    fetch("/api/jarvis/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    logout();
    setUser(null);
  }, []);

  if (user) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border jarvis-border-cyan bg-primary/5 p-3">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
              {user.name}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/60">
              {user.email} · {user.role}
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border jarvis-border-cyan bg-muted/20 p-0.5">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
              mode === m
                ? "bg-primary/20 text-primary jarvis-box-glow"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {mode === "register" && (
          <div>
            <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-8 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[11px] text-foreground/90 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/30"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="h-8 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[11px] text-foreground/90 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
            Password
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="h-8 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[11px] text-foreground/90 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-[9px] text-red-400">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={loading || !email || !password || (mode === "register" && !name)}
        className="jarvis-box-glow w-full gap-2 rounded-lg border jarvis-border-cyan bg-primary/15 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/25"
      >
        <Shield className="h-3.5 w-3.5" />
        {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
      </Button>

      <div className="font-mono text-[8px] text-center text-muted-foreground/40">
        Tokens stored in localStorage · SHA-256 password hashing
      </div>
    </div>
  );
}