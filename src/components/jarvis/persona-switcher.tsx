import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PERSONAS, getPersona } from "@/lib/personas";
import { useUIStore } from "@/lib/ui-store";
import { playSound } from "@/lib/sounds";

export function PersonaSwitcher() {
  const activePersonaId = useUIStore(s => s.activePersonaId);
  const setActivePersonaId = useUIStore(s => s.setActivePersonaId);
  const cyclePersona = useUIStore(s => s.cyclePersona);
  const persona = getPersona(activePersonaId);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => { playSound("click"); cyclePersona(); }}
        className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 transition hover:border-primary/40 hover:bg-primary/10"
        title="Переключить персона"
      >
        <span className="text-base">{persona.icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          {persona.nameEn}
        </span>
        <ChevronRight className="h-3 w-3 text-primary/60" />
      </button>
      
      {/* Expanded selector on hover/click — for now just cycle */}
      <div className="hidden md:flex items-center gap-1">
        {PERSONAS.map(p => (
          <button
            key={p.id}
            onClick={() => { playSound("click"); setActivePersonaId(p.id); }}
            className={`h-6 w-6 rounded-full border transition flex items-center justify-center text-xs ${
              p.id === activePersonaId
                ? "border-primary bg-primary/20 scale-110"
                : "border-primary/20 bg-transparent opacity-50 hover:opacity-100"
            }`}
            title={p.name}
          >
            {p.icon}
          </button>
        ))}
      </div>
    </div>
  );
}