import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Cpu, Quote, ListTodo, X, Sparkles } from "lucide-react";

interface BriefingData {
  greeting: string;
  weather?: { temp: number; condition: string; location: string };
  system: { cpuLoad: number; memPct: number };
  pendingTodos: { id: string; title: string }[];
  quote: { text: string; author: string };
}

const QUOTES = [
  { text: "Инновация отличает лидера от последователя.", author: "Steve Jobs" },
  { text: "Любая достаточно развитая технология неотличима от магии.", author: "Arthur C. Clarke" },
  { text: "Простота — высшая форма изощрённости.", author: "Leonardo da Vinci" },
  { text: "Будущее уже наступило. Просто оно неравномерно распределено.", author: "William Gibson" },
  { text: "Единственный способ делать великую работу — любить то, что делаешь.", author: "Steve Jobs" },
  { text: "Первый шаг — это то, на что 99% людей не способны.", author: "Amelia Earhart" },
  { text: "Код — это поэзия.", author: "JARVIS" },
  { text: "Я работаю на вас уже 24 часа, сэр. И не планирую останавливаться.", author: "JARVIS" },
];

export function DailyBriefing({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<BriefingData | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Доброе утро";
    if (hour >= 12 && hour < 18) timeGreeting = "Добрый день";
    else if (hour >= 18) timeGreeting = "Добрый вечер";

    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    Promise.all([
      fetch("/api/jarvis/weather?lat=55.75&lon=37.62").then((r) => r.json()).catch(() => null),
      fetch("/api/jarvis/system").then((r) => r.json()).catch(() => null),
      fetch("/api/jarvis/notes").then((r) => r.json()).catch(() => ({ notes: [] })),
    ]).then(([weather, system, notes]) => {
      const pendingTodos = (notes?.notes || [])
        .filter((n: { category: string; done: boolean }) => n.category === "tasks" && !n.done)
        .slice(0, 5);

      setData({
        greeting: timeGreeting,
        weather: weather?.temperature
          ? {
              temp: weather.temperature,
              condition: weather.condition || "N/A",
              location: "Москва",
            }
          : undefined,
        system: {
          cpuLoad: system?.cpuLoad ?? 0,
          memPct: system?.memPct ?? 0,
        },
        pendingTodos: pendingTodos.map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })),
        quote,
      });
    });
  }, []);

  if (!data)
    return (
      <div className="p-8 text-center text-primary/50 animate-pulse font-mono text-xs">
        Загрузка сводки...
      </div>
    );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border-2 jarvis-border-cyan jarvis-box-glow-strong bg-card/95 shadow-2xl backdrop-blur-xl p-6"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Daily Briefing
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 border border-primary/20 bg-primary/5 hover:bg-primary/15 transition-colors"
          >
            <X className="w-3 h-3 text-primary/70" />
          </button>
        </div>

        {/* Greeting */}
        <p className="text-lg text-primary font-mono mb-4">{data.greeting}, сэр.</p>

        {/* Grid of info cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {data.weather && (
            <motion.div
              className="border border-[#00d4ff]/20 rounded-lg p-3 bg-card/10"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-mono uppercase text-primary/50">Погода</span>
              </div>
              <p className="text-primary font-mono text-lg">{data.weather.temp}°C</p>
              <p className="text-primary/40 text-[10px]">{data.weather.condition}</p>
            </motion.div>
          )}

          <motion.div
            className="border border-[#00d4ff]/20 rounded-lg p-3 bg-card/10"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-3 h-3 text-primary/60" />
              <span className="text-[10px] font-mono uppercase text-primary/50">Система</span>
            </div>
            <p className="text-primary font-mono text-lg">CPU {data.system.cpuLoad}%</p>
            <p className="text-primary/40 text-[10px]">RAM {data.system.memPct}%</p>
          </motion.div>
        </div>

        {/* Pending TODOs */}
        <AnimatePresence>
          {data.pendingTodos.length > 0 && (
            <motion.div
              className="border border-[#00d4ff]/20 rounded-lg p-3 bg-card/10 mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ListTodo className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-mono uppercase text-amber-400/70">
                  Активные задачи ({data.pendingTodos.length})
                </span>
              </div>
              <ul className="space-y-1">
                {data.pendingTodos.map((todo) => (
                  <li key={todo.id} className="text-xs text-primary/60 font-mono">
                    • {todo.title}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quote */}
        <motion.div
          className="border border-[#00d4ff]/10 rounded-lg p-3 bg-card/5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Quote className="w-3 h-3 text-primary/40" />
            <span className="text-[10px] font-mono uppercase text-primary/40">Цитата дня</span>
          </div>
          <p className="text-sm text-primary/70 italic font-serif">
            «{data.quote.text}»
          </p>
          <p className="text-[10px] text-primary/40 mt-1 text-right">— {data.quote.author}</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}