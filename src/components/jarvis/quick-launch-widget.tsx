

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Plus,
  X,
  Github,
  Code,
  Terminal,
  Send,
  Play,
  Globe,
  Music,
  Tv,
  MessageSquare,
  Search,
  Mail,
  HardDrive,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { playSound } from "@/lib/sounds";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  category: "dev" | "social" | "media" | "tools";
}

type CategoryFilter = "all" | "dev" | "social" | "media" | "tools";

const ICON_MAP: Record<string, LucideIcon> = {
  Github,
  Code,
  Terminal,
  Send,
  Play,
  Globe,
  Music,
  Tv,
  MessageSquare,
  Search,
  Mail,
  HardDrive,
  Link2,
  Rocket,
  X,
  Plus,
};

const DEFAULT_LINKS: QuickLink[] = [
  // Dev
  { id: "github", label: "GitHub", url: "https://github.com", icon: "Github", category: "dev" },
  { id: "stackoverflow", label: "Stack Overflow", url: "https://stackoverflow.com", icon: "Code", category: "dev" },
  { id: "vscode", label: "VS Code Web", url: "https://vscode.dev", icon: "Terminal", category: "dev" },
  // Social
  { id: "telegram", label: "Telegram", url: "https://web.telegram.org", icon: "Send", category: "social" },
  { id: "youtube", label: "YouTube", url: "https://youtube.com", icon: "Play", category: "social" },
  { id: "twitter", label: "Twitter / X", url: "https://x.com", icon: "Globe", category: "social" },
  // Media
  { id: "spotify", label: "Spotify", url: "https://open.spotify.com", icon: "Music", category: "media" },
  { id: "netflix", label: "Netflix", url: "https://netflix.com", icon: "Tv", category: "media" },
  { id: "reddit", label: "Reddit", url: "https://reddit.com", icon: "MessageSquare", category: "media" },
  // Tools
  { id: "google", label: "Google", url: "https://google.com", icon: "Search", category: "tools" },
  { id: "gmail", label: "Gmail", url: "https://mail.google.com", icon: "Mail", category: "tools" },
  { id: "gdrive", label: "Google Drive", url: "https://drive.google.com", icon: "HardDrive", category: "tools" },
];

const STORAGE_KEY = "jarvis-quick-launch";

const CATEGORIES = ["ALL", "DEV", "SOCIAL", "MEDIA", "TOOLS"] as const;

function loadLinks(): QuickLink[] {
  if (typeof window === "undefined") return DEFAULT_LINKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuickLink[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore corrupt data */
  }
  return DEFAULT_LINKS;
}

function saveLinks(links: QuickLink[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {
    /* quota exceeded — silent */
  }
}

export function QuickLaunchWidget() {
  const [links, setLinks] = useState<QuickLink[]>(() => loadLinks());
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Persist whenever links change (after initial load)
  const isInitial = useRef(true);
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    saveLinks(links);
  }, [links]);

  const filteredLinks =
    filter === "all" ? links : links.filter((l) => l.category === filter);

  const handleOpen = useCallback((link: QuickLink) => {
    playSound("click");
    window.open(link.url, "_blank", "noopener,noreferrer");
  }, []);

  const handleRemove = useCallback((id: string) => {
    playSound("deactivate");
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    const url = newUrl.trim();
    const label = newLabel.trim();
    if (!url || !label) return;

    playSound("success");

    const newLink: QuickLink = {
      id: crypto.randomUUID(),
      label,
      url: url.startsWith("http") ? url : `https://${url}`,
      icon: "Link2",
      category: "tools",
    };

    setLinks((prev) => [...prev, newLink]);
    setNewUrl("");
    setNewLabel("");
    setShowAddForm(false);
  }, [newUrl, newLabel]);

  const handleCategoryClick = useCallback((cat: string) => {
    playSound("click");
    setFilter(cat.toLowerCase() as CategoryFilter);
  }, []);

  const handleLongPressStart = useCallback((id: string) => {
    longPressTimer.current = setTimeout(() => {
      handleRemove(id);
      longPressTimer.current = null;
    }, 600);
  }, [handleRemove]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      handleRemove(id);
    },
    [handleRemove]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm"
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Quick Launch
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playSound("click");
              setShowAddForm((prev) => !prev);
            }}
            className="flex items-center justify-center w-6 h-6 rounded-md border jarvis-border-cyan/50 bg-primary/5 text-primary/70 hover:text-primary hover:bg-primary/15 hover:jarvis-box-glow transition"
            title="Add link"
          >
            <Plus className="h-3.5 w-3.5" />
          </motion.button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded transition ${
                filter === cat.toLowerCase()
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-3"
            >
              <div className="rounded-lg border jarvis-border-cyan/30 bg-primary/5 p-2.5 space-y-2">
                <input
                  type="text"
                  placeholder="Label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-full bg-muted/30 border jarvis-border-cyan/30 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition"
                  autoFocus
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="flex-1 bg-muted/30 border jarvis-border-cyan/30 rounded-md px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition"
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!newUrl.trim() || !newLabel.trim()}
                    className="px-2.5 py-1.5 rounded-md border jarvis-border-cyan/50 bg-primary/15 text-primary font-mono text-[10px] uppercase tracking-wider hover:bg-primary/25 hover:jarvis-box-glow transition disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      playSound("click");
                      setShowAddForm(false);
                      setNewUrl("");
                      setNewLabel("");
                    }}
                    className="px-2 py-1.5 rounded-md border jarvis-border-cyan/30 bg-muted/20 text-muted-foreground font-mono text-[10px] hover:text-foreground transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid of links */}
        <div className="grid grid-cols-3 gap-1.5">
          <AnimatePresence mode="popLayout">
            {filteredLinks.map((link) => {
              const Icon = ICON_MAP[link.icon] || Link2;
              const isHovered = hoveredId === link.id;

              return (
                <motion.button
                  key={link.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="group relative flex flex-col items-center gap-1.5 rounded-lg border border-transparent bg-primary/5 p-2.5 transition hover:border-primary/30 hover:bg-primary/10 hover:jarvis-box-glow"
                  onClick={() => handleOpen(link)}
                  onContextMenu={(e) => handleContextMenu(e, link.id)}
                  onMouseDown={() => handleLongPressStart(link.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={() => {
                    handleLongPressEnd();
                    setHoveredId(null);
                  }}
                  onMouseEnter={() => setHoveredId(link.id)}
                  onTouchStart={() => handleLongPressStart(link.id)}
                  onTouchEnd={handleLongPressEnd}
                  title={`${link.label} — ${link.url}\nRight-click or long-press to remove`}
                >
                  {/* Delete button on hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.12 }}
                        className="absolute -top-1 -right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-destructive/80 text-destructive-foreground shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(link.id);
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <Icon className="h-5 w-5 text-primary/70 group-hover:text-primary transition" />
                  <span className="font-mono text-[9px] text-muted-foreground group-hover:text-foreground transition truncate w-full text-center">
                    {link.label}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {filteredLinks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-6 text-muted-foreground/50"
          >
            <Globe className="h-8 w-8 mb-2 text-primary/20" />
            <span className="font-mono text-[10px]">No links in this category</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}