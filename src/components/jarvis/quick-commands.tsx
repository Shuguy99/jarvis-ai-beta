"use client";

import { Clock, Globe, Code2, Lightbulb, CalendarDays, Sparkles, Zap, Calculator, Image, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { playSound } from "@/lib/sounds";

interface QuickCommand {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}

const COMMANDS: QuickCommand[] = [
  { icon: Clock, label: "Время", prompt: "Который сейчас час и какая дата? Дай краткий статус." },
  { icon: Globe, label: "Новости", prompt: "Найди главные новости технологий за сегодня и кратко перескажи." },
  { icon: Code2, label: "Код", prompt: "Напиши на TypeScript функцию debounce с типами и примером использования." },
  { icon: Lightbulb, label: "Идея", prompt: "Предложи 3 идеи для pet-проекта на выходные с использованием AI." },
  { icon: CalendarDays, label: "План", prompt: "Составь план обучения React и Next.js на 4 недели для junior." },
  { icon: Sparkles, label: "Творчество", prompt: "Придумай короткую sci-fi историю про ИИ-помощника за 5 предложений." },
  { icon: Zap, label: "Статус", prompt: "Дай полный отчёт о готовности систем, как настоящий J.A.R.V.I.S." },
  { icon: Calculator, label: "Калькулятор", prompt: "Я дам тебе математическое выражение — посчитай и покажи подробное решение." },
  { icon: Image, label: "Опиши", prompt: "Я загружу изображение — когда загрузится, опиши что на нём изображено в деталях." },
  { icon: ShieldCheck, label: "Диагностика", prompt: "Проведи полную диагностику системы: проверь все модули и дай подробный отчёт." },
];

export function QuickCommands({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COMMANDS.map((c) => (
        <motion.button
          key={c.label}
          onClick={() => { playSound("click"); onPick(c.prompt); }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="group flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-sm transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:jarvis-box-glow"
        >
          <c.icon className="h-3 w-3 transition group-hover:text-primary" />
          {c.label}
        </motion.button>
      ))}
    </div>
  );
}