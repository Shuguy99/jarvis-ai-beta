"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useUIStore } from "@/lib/ui-store";
import { playSound } from "@/lib/sounds";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface PrivacyOption {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

const PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    id: "saveHistory",
    label: "Сохранять историю диалогов",
    description: "Переписка хранится локально в браузере",
    defaultChecked: true,
  },
  {
    id: "useRAG",
    label: "Использовать RAG для контекста",
    description: "Документы индексируются локально для поиска",
    defaultChecked: true,
  },
  {
    id: "anonymousStats",
    label: "Отправлять анонимную статистику",
    description: "Безопасная телеметрия для улучшения",
    defaultChecked: false,
  },
  {
    id: "systemLogs",
    label: "Сохранять логи системы",
    description: "Отладочная информация для диагностики",
    defaultChecked: false,
  },
];

export function PrivacyWizard() {
  const privacyWizardShown = useUIStore((s) => s.privacyWizardShown);
  const setPrivacyWizardShown = useUIStore((s) => s.setPrivacyWizardShown);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const opt of PRIVACY_OPTIONS) {
      initial[opt.id] = opt.defaultChecked;
    }
    return initial;
  });

  const open = !privacyWizardShown;

  function toggle(id: string) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleStart() {
    // Save preferences to settings API
    fetch("/api/jarvis/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privacy: {
          saveHistory: prefs.saveHistory,
          useRAG: prefs.useRAG,
          anonymousStats: prefs.anonymousStats,
          systemLogs: prefs.systemLogs,
        },
      }),
    }).catch(() => {
      /* API unavailable, preferences still stored in localStorage via the flag */
    });

    playSound("activate");
    setPrivacyWizardShown(true);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="border jarvis-border-cyan bg-card/95 backdrop-blur-md sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-primary jarvis-glow">
            <ShieldCheck className="h-5 w-5" />
            Настройка приватности
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            JARVIS работает полностью локально, но вы можете дополнительно
            настроить конфиденциальность:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {PRIVACY_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-primary/20 hover:bg-primary/5"
            >
              <Checkbox
                checked={prefs[opt.id]}
                onCheckedChange={() => toggle(opt.id)}
                className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  {opt.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {opt.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-lg border jarvis-border-cyan bg-primary/20 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary transition hover:bg-primary/30 hover:jarvis-box-glow"
          >
            Начать работу
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}