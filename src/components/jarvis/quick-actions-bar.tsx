

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { playSound } from "@/lib/sounds";

export interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

export interface QuickActionsBarProps {
  actions: QuickAction[];
}

const SEPARATOR_INTERVAL = 4;
const STORAGE_KEY = "jarvis-actions-bar-collapsed";

function SeparatorDot() {
  return (
    <span
      className="mx-1.5 w-1 h-1 rounded-full bg-primary/20 shrink-0"
      aria-hidden="true"
    />
  );
}

function ToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = collapsed ? MoreHorizontal : ChevronDown;

  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        playSound("click", 0.2);
        onToggle();
      }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      className="rounded-full w-9 h-9 flex items-center justify-center border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:border-primary/40 transition-all shrink-0"
      aria-label={collapsed ? "Expand quick actions" : "Collapse quick actions"}
    >
      <Icon className="h-4 w-4 text-primary/70 hover:text-primary transition-colors" />
    </motion.button>
  );
}

function ActionBar({
  actions,
  collapsed,
  onToggleCollapse,
}: {
  actions: QuickAction[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const groupedActions: (QuickAction | "separator")[] = actions.reduce<
    (QuickAction | "separator")[]
  >((acc, action, idx) => {
    if (idx > 0 && idx % SEPARATOR_INTERVAL === 0) {
      acc.push("separator");
    }
    acc.push(action);
    return acc;
  }, []);

  return (
    <motion.div
      layout
      className="jarvis-box-glow flex items-center backdrop-blur-xl bg-card/60 border border-primary/20 rounded-full px-3 py-2 overflow-x-auto jarvis-desktop-no-scroll max-w-full"
    >
      <AnimatePresence mode="popLayout">
        {!collapsed &&
          groupedActions.map((item, idx) => {
            if (item === "separator") {
              return (
                <motion.span
                  key={`sep-${idx}`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <SeparatorDot />
                </motion.span>
              );
            }

            const action = item;
            const Icon = action.icon;

            return (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{
                  duration: 0.2,
                  delay: idx * 0.03,
                }}
                className="shrink-0"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => {
                        playSound("click", 0.2);
                        action.onClick();
                      }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      className="rounded-full w-9 h-9 flex items-center justify-center border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:border-primary/40 transition-all"
                      aria-label={action.label}
                    >
                      <Icon className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="font-mono text-[11px] tracking-wider bg-card/90 text-primary border border-primary/30 backdrop-blur-md"
                  >
                    {action.label}
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: collapsed ? 0 : actions.length * 0.03 }}
        className="shrink-0"
      >
        <ToggleButton collapsed={collapsed} onToggle={onToggleCollapse} />
      </motion.div>
    </motion.div>
  );
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <nav
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[calc(100vw-2rem)]"
      aria-label="Quick actions"
    >
      <ActionBar
        actions={actions}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
    </nav>
  );
}