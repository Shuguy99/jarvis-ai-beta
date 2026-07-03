"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Github, RefreshCw, Star, GitFork, CircleDot, Eye, ExternalLink } from "lucide-react";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ── Types ─────────────────────────────────────────────────────
interface GitHubRepo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  pushed_at: string;
}

interface GitHubActor {
  login: string;
  avatar_url: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  displayType: string;
  actor: GitHubActor;
  created_at: string;
  payload: Record<string, any>;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
}

interface GitHubData {
  repo: GitHubRepo;
  recentEvents: GitHubEvent[];
  releases: GitHubRelease[];
}

// ── Helpers ────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}д назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function eventDescription(event: GitHubEvent): string {
  switch (event.type) {
    case "PushEvent": {
      const ref = event.payload?.ref as string | undefined;
      const branch = ref?.replace("refs/heads/", "") ?? "unknown";
      return `Pushed to ${branch}`;
    }
    case "ReleaseEvent":
      return `Released ${event.payload?.release?.tag_name ?? ""}`;
    case "IssuesEvent": {
      const action = event.payload?.action ?? "updated";
      const num = event.payload?.issue?.number ?? "?";
      const title = event.payload?.issue?.title ?? "";
      return `${action} issue #${num}: ${title}`;
    }
    case "WatchEvent":
      return "Starred the repo";
    case "ForkEvent":
      return "Forked the repo";
    default:
      return event.displayType;
  }
}

function eventBadgeColor(type: string): string {
  switch (type) {
    case "PushEvent":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "ReleaseEvent":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "IssuesEvent":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "WatchEvent":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "ForkEvent":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-primary/10 text-primary/60 border-primary/20";
  }
}

// ── Skeleton loader ────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-primary/10" />
        ))}
      </div>
      <div className="border-t jarvis-border-cyan pt-2" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-primary/10" />
            <div className="h-3 w-20 rounded bg-primary/10" />
            <div className="h-3 flex-1 rounded bg-primary/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat block ─────────────────────────────────────────────────
function StatBlock({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-primary/5 py-2 transition-colors hover:bg-primary/10">
      <Icon className="h-3.5 w-3.5 text-primary/60" />
      <span className="text-primary font-mono text-sm font-bold">{value.toLocaleString()}</span>
      <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function GitHubWidget() {
  const [data, setData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchGitHub = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/github");
      if (!res.ok) throw new Error();
      const json: GitHubData = await res.json();
      setData(json);
      setError(false);
      addActivityEvent({
        severity: "success",
        category: "system",
        message: `GitHub: ${json.repo.full_name} — ${json.recentEvents.length} событий`,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGitHub();
    const id = setInterval(() => void fetchGitHub(), 120_000);
    return () => clearInterval(id);
  }, [fetchGitHub]);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 backdrop-blur-sm p-4">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              GITHUB
            </span>
          </div>
        </div>
        <Skeleton />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 backdrop-blur-sm p-4">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              GITHUB
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="font-mono text-xs text-muted-foreground">
            Нет подключения к GitHub
          </span>
          <button
            onClick={() => { setError(false); setLoading(true); void fetchGitHub(); }}
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
          >
            <RefreshCw className="h-3 w-3" />
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { repo, recentEvents, releases } = data;
  const events = recentEvents.slice(0, 5);
  const latestRelease = releases[0] ?? null;

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 backdrop-blur-sm p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="relative flex flex-col gap-3">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              GITHUB
            </span>
          </div>
          <button
            onClick={() => { setLoading(true); void fetchGitHub(); }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="Обновить"
            aria-label="Обновить"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {/* ── Repo name (clickable) ────────────────────────── */}
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5"
        >
          <span className="font-mono text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
            {repo.full_name}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </a>

        {/* ── Stats grid (2×2) ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <StatBlock icon={Star} value={repo.stargazers_count} label="Stars" />
          <StatBlock icon={GitFork} value={repo.forks_count} label="Forks" />
          <StatBlock icon={CircleDot} value={repo.open_issues_count} label="Issues" />
          <StatBlock icon={Eye} value={repo.subscribers_count} label="Watchers" />
        </div>

        {/* ── Recent Activity ───────────────────────────────── */}
        {events.length > 0 && (
          <div className="border-t jarvis-border-cyan pt-2">
            <div className="mb-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              ── Activity ──
            </div>
            <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto scrollbar-thin">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-2 text-[10px]">
                  <img
                    src={event.actor.avatar_url}
                    alt={event.actor.login}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-foreground/80 truncate">
                        {event.actor.login}
                      </span>
                      <span className={`inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-px font-mono text-[8px] font-medium ${eventBadgeColor(event.type)}`}>
                        {event.displayType}
                      </span>
                    </div>
                    <div className="font-mono text-muted-foreground truncate">
                      {eventDescription(event)}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground/60">
                      {timeAgo(event.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Latest Release ────────────────────────────────── */}
        {latestRelease && (
          <div className="border-t jarvis-border-cyan pt-2">
            <div className="mb-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              ── Latest Release ──
            </div>
            <a
              href={latestRelease.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-0.5 rounded-lg bg-primary/5 p-2 transition-colors hover:bg-primary/10"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-primary">
                  {latestRelease.tag_name}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {latestRelease.name && latestRelease.name !== latestRelease.tag_name && (
                <span className="font-mono text-[10px] text-muted-foreground truncate">
                  {latestRelease.name}
                </span>
              )}
              <span className="font-mono text-[9px] text-muted-foreground/60">
                Published {timeAgo(latestRelease.published_at)}
              </span>
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}