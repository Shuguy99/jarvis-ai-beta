export const runtime = "nodejs";

import { execFile as cpExecFile } from "child_process";
import { promisify } from "util";
const execFile = promisify(cpExecFile);
import { NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────────

interface RepoInfo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  size: number;
  default_branch: string;
  pushed_at: string;
  created_at: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  displayType: string;
  actor: { login: string; avatar_url: string };
  created_at: string;
  payload: Record<string, unknown>;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
}

interface GithubData {
  repo: RepoInfo;
  recentEvents: GitHubEvent[];
  releases: GitHubRelease[];
}

// ── Display type map ───────────────────────────────────────────────────────

const DISPLAY_TYPE_MAP: Record<string, string> = {
  PushEvent: "Push",
  ReleaseEvent: "Release",
  IssuesEvent: "Issue",
  IssueCommentEvent: "Comment",
  PullRequestEvent: "Pull Request",
  CreateEvent: "Create",
  DeleteEvent: "Delete",
  ForkEvent: "Fork",
  WatchEvent: "Star",
};

function getDisplayType(type: string): string {
  return DISPLAY_TYPE_MAP[type] ?? type;
}

// ── Token extraction ───────────────────────────────────────────────────────

async function getGitHubToken(): Promise<string> {
  // Priority: env var > git remote (never expose to client)
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;

  try {
    const { stdout } = await execFile("git", ["remote", "get-url", "origin"], {
      cwd: "/home/z/my-project",
      timeout: 5000,
    });
    const remoteUrl = stdout.toString().trim();
    // Extract token from https://<TOKEN>@github.com/... format
    const match = remoteUrl.match(/^https?:\/\/([^@]+)@github\.com/);
    if (match?.[1] && !match[1].includes("://")) {
      return match[1];
    }
  } catch {
    // git remote not available
  }

  return ""; // Unauthenticated — limited to 60 req/hour
}

// ── GitHub fetch helpers ───────────────────────────────────────────────────

function githubHeaders(token: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "JARVIS-AI-Beta",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchRepo(token: string): Promise<RepoInfo> {
  const res = await fetch(
    "https://api.github.com/repos/Shuguy99/jarvis-ai-beta",
    { headers: githubHeaders(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`GitHub API repo error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    full_name: data.full_name,
    description: data.description ?? "",
    html_url: data.html_url,
    stargazers_count: data.stargazers_count,
    forks_count: data.forks_count,
    open_issues_count: data.open_issues_count,
    subscribers_count: data.subscribers_count,
    size: data.size,
    default_branch: data.default_branch,
    pushed_at: data.pushed_at,
    created_at: data.created_at,
  };
}

async function fetchEvents(token: string): Promise<GitHubEvent[]> {
  const res = await fetch(
    "https://api.github.com/repos/Shuguy99/jarvis-ai-beta/events?per_page=15",
    { headers: githubHeaders(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub API events error: ${res.status} ${res.statusText}`
    );
  }
  const data: Array<Record<string, unknown>> = await res.json();
  return data.map((event) => {
    const actor = event.actor as { login: string; avatar_url: string };
    const payload = event.payload as Record<string, unknown>;

    // Shape the payload based on event type
    const shapedPayload: Record<string, unknown> = {};
    if (event.type === "PushEvent") {
      shapedPayload.commits = (
        (payload.commits as Array<{ message: string }>) ?? []
      ).map((c) => ({ message: c.message }));
    } else if (event.type === "ReleaseEvent") {
      const release = payload.release as
        | { tag_name: string; name: string }
        | undefined;
      shapedPayload.release = release
        ? { tag_name: release.tag_name, name: release.name }
        : null;
    } else if (event.type === "IssuesEvent") {
      const issue = payload.issue as
        | { number: number; title: string; state: string }
        | undefined;
      shapedPayload.issue = issue
        ? { number: issue.number, title: issue.title, state: issue.state }
        : null;
    } else {
      // For other event types, pass raw payload
      Object.assign(shapedPayload, payload);
    }

    return {
      id: event.id as string,
      type: event.type as string,
      displayType: getDisplayType(event.type as string),
      actor: { login: actor.login, avatar_url: actor.avatar_url },
      created_at: event.created_at as string,
      payload: shapedPayload,
    };
  });
}

async function fetchReleases(token: string): Promise<GitHubRelease[]> {
  const res = await fetch(
    "https://api.github.com/repos/Shuguy99/jarvis-ai-beta/releases?per_page=5",
    { headers: githubHeaders(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(
      `GitHub API releases error: ${res.status} ${res.statusText}`
    );
  }
  const data: Array<Record<string, string>> = await res.json();
  return data.map((r) => ({
    tag_name: r.tag_name,
    name: r.name,
    published_at: r.published_at,
    html_url: r.html_url,
  }));
}

// ── In-memory cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
let cachedData: { data: GithubData; timestamp: number } | null = null;

async function getGitHubData(forceRefresh: boolean): Promise<GithubData> {
  // Return cached data if valid and not forced refresh
  if (
    !forceRefresh &&
    cachedData &&
    Date.now() - cachedData.timestamp < CACHE_TTL_MS
  ) {
    return cachedData.data;
  }

  const token = await getGitHubToken();

  const [repo, recentEvents, releases] = await Promise.all([
    fetchRepo(token),
    fetchEvents(token),
    fetchReleases(token),
  ]);

  const result: GithubData = { repo, recentEvents, releases };

  cachedData = { data: result, timestamp: Date.now() };
  return result;
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await getGitHubData(false);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST() {
  try {
    const data = await getGitHubData(true);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}