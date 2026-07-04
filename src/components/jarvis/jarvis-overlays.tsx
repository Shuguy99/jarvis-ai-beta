"use client";

// Оверлей-панели — boot, команды, заметки, markdown, агент, плагины, раскладка, уведомления, настройки
// Извлечён из page.tsx (бывшие строки 381-601)
// Токены ~2k, время рендера ~2ms (ленивые панели загружаются отдельно)

import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/lib/ui-store";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import type { JarvisSettingsData } from "@/components/jarvis/settings-panel";
import type { ParsedCommand } from "@/lib/voice-commands";
import { ErrorFlash } from "@/components/jarvis/error-flash";
import { BootSequence } from "@/components/jarvis/boot-sequence";
import { VoiceCommandOverlay } from "@/components/jarvis/voice-command-overlay";
import { NotesPanel } from "@/components/jarvis/notes-panel";
import { CommandPalette, type CommandItem } from "@/components/jarvis/command-palette";
import { showNotification, NotificationToastContainer } from "@/components/jarvis/notification-toast";
import {
  LazyAgentPanel, LazyPluginPanel, LazyLayoutCustomizer,
  LazyNotificationCenter, LazySettingsPanel, LazyMarkdownWidget,
  LazyThemeEditor,
  JarvisSuspense,
} from "@/lib/lazy-components";

interface JarvisOverlaysProps {
  jarvis: UseJarvisReturn;
  commands: CommandItem[];
  lastCommand: ParsedCommand | null;
  onBootComplete: () => void;
}

export function JarvisOverlays({ jarvis, commands, lastCommand, onBootComplete }: JarvisOverlaysProps) {
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const notesOpen = useUIStore((s) => s.notesOpen);
  const markdownOpen = useUIStore((s) => s.markdownOpen);
  const agentOpen = useUIStore((s) => s.agentOpen);
  const pluginOpen = useUIStore((s) => s.pluginOpen);
  const layoutOpen = useUIStore((s) => s.layoutOpen);
  const notifOpen = useUIStore((s) => s.notifOpen);
  const themeEditorOpen = useUIStore((s) => s.themeEditorOpen);

  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setNotesOpen = useUIStore((s) => s.setNotesOpen);
  const setMarkdownOpen = useUIStore((s) => s.setMarkdownOpen);
  const setAgentOpen = useUIStore((s) => s.setAgentOpen);
  const setPluginOpen = useUIStore((s) => s.setPluginOpen);
  const setLayoutOpen = useUIStore((s) => s.setLayoutOpen);
  const setNotifOpen = useUIStore((s) => s.setNotifOpen);
  const setJarvisSettings = useUIStore((s) => s.setJarvisSettings);
  const setThemeEditorOpen = useUIStore((s) => s.setThemeEditorOpen);

  // Error flash — key changes on each new error message
  const errorFlashKey = jarvis.state === "error" ? jarvis.error ?? "err" : 0;

  return (
    <>
      {/* Error Flash Overlay */}
      {jarvis.state === "error" && <ErrorFlash key={errorFlashKey} />}

      {/* Notification Toasts */}
      <NotificationToastContainer />

      {/* Boot Sequence Overlay */}
      <BootSequence onComplete={onBootComplete} />

      {/* Voice Command Overlay */}
      <VoiceCommandOverlay command={lastCommand} />

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        messages={jarvis.messages.map((m) => ({ id: m.id, content: m.content, role: m.role, createdAt: m.createdAt }))}
        conversations={jarvis.conversations.map((c) => ({ id: c.id, title: c.title || "Без названия", updatedAt: c.updatedAt }))}
      />

      {/* Settings Panel */}
      <JarvisSuspense>
        <LazySettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={(s: JarvisSettingsData) => {
            jarvis.updateTTSSettings?.(s.ttsRate, s.ttsPitch, s.volume);
            if (s.autoSpeak !== jarvis.autoSpeakOn) jarvis.setAutoSpeakOn(s.autoSpeak);
            setJarvisSettings(s);
            showNotification({ title: "Конфигурация сохранена", message: "Настройки JARVIS обновлены", type: "success" });
          }}
        />
      </JarvisSuspense>

      {/* Notes Panel Overlay */}
      <AnimatePresence>
        {notesOpen && (
          <motion.div
            className="absolute right-4 top-3 z-30 w-80 sm:w-96"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <NotesPanel open={notesOpen} onClose={() => setNotesOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Markdown Editor Overlay */}
      <AnimatePresence>
        {markdownOpen && (
          <motion.div
            className="absolute right-4 top-3 z-30 w-[400px] sm:w-[520px]"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <JarvisSuspense><LazyMarkdownWidget onClose={() => setMarkdownOpen(false)} /></JarvisSuspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Panel Overlay */}
      <JarvisSuspense><LazyAgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} /></JarvisSuspense>

      {/* Plugin Panel Overlay */}
      <JarvisSuspense><LazyPluginPanel open={pluginOpen} onClose={() => setPluginOpen(false)} /></JarvisSuspense>

      {/* Layout Customizer Overlay */}
      <JarvisSuspense><LazyLayoutCustomizer open={layoutOpen} onClose={() => setLayoutOpen(false)} /></JarvisSuspense>

      {/* Notification Center Overlay */}
      <JarvisSuspense><LazyNotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} /></JarvisSuspense>

      {/* Theme Editor Overlay */}
      <JarvisSuspense><LazyThemeEditor open={themeEditorOpen} onOpenChange={setThemeEditorOpen} /></JarvisSuspense>
    </>
  );
}