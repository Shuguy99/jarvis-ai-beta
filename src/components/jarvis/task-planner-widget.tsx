"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, AlertTriangle, Play, Trash2, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import type { TaskPlan, TaskItem } from "@/lib/task-planner";
import { updateTaskStatus } from "@/lib/task-planner";
import { playSound } from "@/lib/sounds";

interface TaskPlannerWidgetProps {
  plan: TaskPlan | null;
  onUpdatePlan: (plan: TaskPlan) => void;
  onClearPlan: () => void;
}

const STATUS_CONFIG: Record<TaskItem["status"], { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Circle className="h-3.5 w-3.5" />, color: "text-muted-foreground", label: "Ожидает" },
  in_progress: { icon: <Play className="h-3.5 w-3.5" />, color: "text-primary", label: "В работе" },
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-400", label: "Готово" },
  failed: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-destructive", label: "Ошибка" },
  skipped: { icon: <CheckCircle2 className="h-3.5 w-3.5 opacity-50" />, color: "text-muted-foreground", label: "Пропущено" },
};

const PRIORITY_COLORS: Record<TaskItem["priority"], string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-primary/10 text-primary/70 border-primary/20",
};

export function TaskPlannerWidget({ plan, onUpdatePlan, onClearPlan }: TaskPlannerWidgetProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <ListChecks className="mb-2 h-8 w-8 text-primary/30" />
        <p className="font-mono text-[10px] text-muted-foreground">
          Нет активного плана задач
        </p>
        <p className="font-mono text-[9px] text-muted-foreground/60">
          Скажите &quot;спланируй...&quot; для создания плана
        </p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cycleStatus = (taskId: string) => {
    playSound("click");
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) return;
    const nextStatus: TaskItem["status"] =
      task.status === "pending" ? "in_progress" :
      task.status === "in_progress" ? "completed" :
      "pending";
    onUpdatePlan(updateTaskStatus(plan, taskId, nextStatus));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary anim-pulse-glow" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">Task Planner</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {plan.tasks.filter(t => t.status === "completed").length}/{plan.tasks.length}
          </span>
          <button
            onClick={() => { playSound("deactivate"); onClearPlan(); }}
            className="ml-1 rounded p-0.5 text-muted-foreground/50 hover:text-destructive transition"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
        <div className="font-mono text-[11px] font-bold text-primary">{plan.title}</div>
        {plan.description && (
          <div className="mt-1 font-mono text-[9px] text-muted-foreground line-clamp-2">{plan.description}</div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[9px]">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="text-primary">{plan.overallProgress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${plan.overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto jarvis-scroll">
        <AnimatePresence>
          {plan.tasks.map((task, idx) => {
            const cfg = STATUS_CONFIG[task.status];
            const isExpanded = expandedTasks.has(task.id);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-lg border transition ${
                  task.status === "completed"
                    ? "border-green-500/20 bg-green-500/5 opacity-70"
                    : task.status === "in_progress"
                    ? "border-primary/30 bg-primary/5"
                    : "border-primary/10 bg-card/30"
                }`}
              >
                <div
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                  onClick={() => toggleExpand(task.id)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); cycleStatus(task.id); }}
                    className={`${cfg.color} transition hover:scale-110 flex-shrink-0`}
                  >
                    {cfg.icon}
                  </button>
                  <span className={`flex-1 font-mono text-[10px] ${
                    task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                  }`}>
                    {task.title}
                  </span>
                  <span className={`rounded border px-1 font-mono text-[8px] ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority.slice(0, 1).toUpperCase()}
                  </span>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
                </div>
                <AnimatePresence>
                  {isExpanded && task.description && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-primary/10 px-2 py-1.5">
                        <p className="font-mono text-[9px] text-muted-foreground">{task.description}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}