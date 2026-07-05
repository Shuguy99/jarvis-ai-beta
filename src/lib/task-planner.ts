/**
 * JARVIS Task Planner
 * AI-powered task decomposition with progress tracking
 */

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  priority: "high" | "medium" | "low";
  estimatedMinutes?: number;
  completedAt?: string;
  subtasks?: string[];
}

export interface TaskPlan {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tasks: TaskItem[];
  status: "planning" | "active" | "completed" | "cancelled";
  overallProgress: number; // 0-100
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function createPlan(title: string, description: string): TaskPlan {
  return {
    id: uid(),
    title,
    description,
    createdAt: new Date().toISOString(),
    tasks: [],
    status: "planning",
    overallProgress: 0,
  };
}

export function calculateProgress(tasks: TaskItem[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => t.status === "completed" || t.status === "skipped").length;
  return Math.round((done / tasks.length) * 100);
}

export function updateTaskStatus(plan: TaskPlan, taskId: string, status: TaskItem["status"]): TaskPlan {
  const tasks = plan.tasks.map(t =>
    t.id === taskId ? { ...t, status, completedAt: status === "completed" ? new Date().toISOString() : undefined } : t
  );
  const completedCount = tasks.filter(t => t.status === "completed" || t.status === "skipped").length;
  const allDone = completedCount === tasks.length && tasks.length > 0;
  return {
    ...plan,
    tasks,
    overallProgress: calculateProgress(tasks),
    status: allDone ? "completed" : plan.status === "planning" ? "active" : plan.status,
  };
}

/**
 * Parse AI response into a TaskPlan
 * AI returns tasks in a structured format like:
 * ## Задача: Build a website
 * 1. [ ] High: Design mockup — Create wireframes
 * 2. [ ] Medium: Setup project — Initialize repo
 * 3. [x] Low: Research — Check existing solutions
 */
export function parseTaskPlanFromAI(title: string, aiResponse: string): TaskPlan {
  const plan = createPlan(title, aiResponse.slice(0, 200));

  const lines = aiResponse.split("\n");
  const tasks: TaskItem[] = [];

  for (const line of lines) {
    // Match patterns: "1. [ ] High: Title — Description" or "- [x] Medium: Title: Description"
    const match = line.match(/^\s*\d+\.\s*\[([ xX])\]\s*(High|Medium|Low|Высокий|Средний|Низкий)?\s*:?\s*(.+?)(?:\s*[—–-]\s*(.+))?$/i)
      || line.match(/^\s*[-*]\s*\[([ xX])\]\s*(High|Medium|Low|Высокий|Средний|Низкий)?\s*:?\s*(.+?)(?:\s*[—–-]\s*(.+))?$/i);

    if (match) {
      const checked = match[1].toLowerCase() === "x";
      const priorityRaw = (match[2] || "Medium").toLowerCase();
      let priority: TaskItem["priority"] = "medium";
      if (priorityRaw.includes("high") || priorityRaw.includes("высок")) priority = "high";
      else if (priorityRaw.includes("low") || priorityRaw.includes("низк")) priority = "low";

      tasks.push({
        id: uid(),
        title: match[3].trim(),
        description: (match[4] || "").trim(),
        status: checked ? "completed" : "pending",
        priority,
      });
    }
  }

  if (tasks.length > 0) {
    plan.tasks = tasks;
    plan.status = "active";
    plan.overallProgress = calculateProgress(tasks);
  }

  return plan;
}

export function generatePlanPrompt(userRequest: string): string {
  return `Пользователь просит спланировать задачу. Разбей её на конкретные подзадачи.

Формат ответа (СТРОГО соблюдай):
## ${userRequest}

1. [ ] Приоритет: Название задачи — Краткое описание
2. [ ] Приоритет: Название задачи — Краткое описание
...

Приоритеты: High, Medium, Low
Если какие-то шаги уже сделаны, отметь их как [x].

Запрос пользователя: ${userRequest}`;
}