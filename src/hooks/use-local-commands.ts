import { useJarvisStore, type CommandHandlers } from "@/lib/jarvis-store";

// ── Local command processing ────────────────────────────────
// Parses user input with regex for local actions (notes, timers,
// weather, etc.) without involving the LLM. Returns null when the
// text should be sent to the server for a conversational reply.

export async function processLocalCommand(
  text: string,
  handlers: CommandHandlers
): Promise<{ handled: boolean; response?: string } | null> {
  const cmd = text.trim().toLowerCase();

  // Create note
  const noteMatch =
    cmd.match(/^(?:запиши|создай заметку|заметка|добавь заметку|новая заметка)[:\s]+(.+)/i);
  if (noteMatch) {
    const noteText = noteMatch[1].trim();
    try {
      const res = await fetch("/api/jarvis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: noteText, content: noteText }),
      });
      const data = await res.json();
      if (data.note) {
        return { handled: true, response: `Заметка сохранена, сэр: «${noteText}»` };
      }
    } catch {
      /* ignore */
    }
    return { handled: true, response: "Не удалось сохранить заметку, сэр." };
  }

  // List notes
  if (/^(какие заметки|покажи заметк|список заметок|мои заметки|что в замет)/i.test(cmd)) {
    try {
      const res = await fetch("/api/jarvis/notes");
      const data = await res.json();
      const notes = data.notes ?? [];
      if (notes.length === 0) {
        return { handled: true, response: "У вас пока нет заметок, сэр." };
      }
      const lines = notes
        .slice(0, 10)
        .map(
          (n: { done: boolean; title: string }, i: number) =>
            `${n.done ? "\u2611" : "\u2610"} ${i + 1}. ${n.title}`
        )
        .join("\n");
      return {
        handled: true,
        response: `Ваши заметки (${notes.length}):\n${lines}${notes.length > 10 ? `\n\u2026 и ещё ${notes.length - 10}` : ""}`,
      };
    } catch {
      return { handled: true, response: "Не удалось загрузить заметки, сэр." };
    }
  }

  // Delete all notes
  if (/^(удали все заметки|удали заметки|очисти заметки|удали все задачи)/i.test(cmd)) {
    try {
      await fetch("/api/jarvis/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "all" }),
      });
      return { handled: true, response: "Все заметки удалены, сэр." };
    } catch {
      return { handled: true, response: "Не удалось удалить заметки, сэр." };
    }
  }

  // Timer
  const timerMatch = cmd.match(
    /(?:таймер|таймер на|поставь таймер|установи таймер|заведи таймер)\s+(\d+(?:[.,]\d+)?)\s*(?:минут|мин|minutes?|m|секунд|сек|seconds?|s)?/i
  );
  if (timerMatch) {
    const num = parseFloat(timerMatch[1].replace(",", "."));
    const hasSec = /секунд|сек|seconds?|s/i.test(cmd);
    const seconds = hasSec ? Math.round(num) : Math.round(num * 60);
    if (seconds > 0 && handlers.startTimer) {
      handlers.startTimer(seconds);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const display = mins > 0 ? `${mins} мин${secs > 0 ? ` ${secs} сек` : ""}` : `${secs} сек`;
      return { handled: true, response: `Таймер установлен на ${display}, сэр.` };
    }
    return { handled: true, response: "Таймер недоступен, сэр." };
  }

  // Stop/reset timer
  if (/^(стоп таймер|сбрось таймер|останови таймер|отмени таймер)/i.test(cmd)) {
    if (handlers.stopTimer) handlers.stopTimer();
    if (handlers.resetTimer) handlers.resetTimer();
    return { handled: true, response: "Таймер остановлен, сэр." };
  }

  // Calculator
  if (/^(калькулятор|открой калькулятор|покажи калькулятор|посчитай)/i.test(cmd)) {
    if (handlers.toggleCalculator) handlers.toggleCalculator();
    return { handled: true, response: "Калькулятор активирован, сэр." };
  }

  // Notes
  if (/^(заметки|открой заметки|покажи заметки|мои записи)/i.test(cmd)) {
    if (handlers.openNotes) handlers.openNotes();
    return { handled: true, response: "Панель заметок открыта, сэр." };
  }

  // Fullscreen
  if (/^(полный экран|фуллскрин|во весь экран|fullscreen)/i.test(cmd)) {
    if (handlers.toggleFullscreen) handlers.toggleFullscreen();
    return { handled: true, response: "Полноэкранный режим активирован, сэр." };
  }

  // Settings
  if (/^(настройки|параметры|открой настройки|settings)/i.test(cmd)) {
    if (handlers.openSettings) handlers.openSettings();
    return { handled: true, response: "Панель настроек открыта, сэр." };
  }

  // Screen capture
  if (/^(скриншот|захват экрана|покажи экран|сделай скриншот|screen capture)/i.test(cmd)) {
    if (handlers.captureScreen) handlers.captureScreen();
    return { handled: true, response: "Инициализирую захват экрана, сэр." };
  }

  // Theme
  const themeMatch = cmd.match(/(?:марк|mark|тема|theme)\s+(1|42|50)/i);
  if (themeMatch) {
    const themeId = `mark-${themeMatch[1]}`;
    if (handlers.setTheme) handlers.setTheme(themeId);
    return { handled: true, response: `Костюм Mark ${themeMatch[1]} активирован, сэр.` };
  }

  // Mute/unmute
  if (/^(тихо|замолчи|молчи|выключи голос|mute)/i.test(cmd)) {
    useJarvisStore.getState().setAutoSpeakOn(false);
    return { handled: true, response: "Режим молчания активирован, сэр." };
  }
  if (/^(говори|голос|включи голос|звук|unmute)/i.test(cmd)) {
    useJarvisStore.getState().setAutoSpeakOn(true);
    return { handled: true, response: "Голосовой вывод восстановлен, сэр." };
  }

  // New chat — uses store directly, no TDZ issue
  if (/^(новый чат|новый разговор|очисти чат|новая сессия|новый диалог)/i.test(cmd)) {
    useJarvisStore.getState().clearChat();
    useJarvisStore.getState().setActiveConvoId(null);
    return { handled: true, response: "Новая сессия инициализирована, сэр." };
  }

  // Weather — delegate to LLM
  if (/^(погода|какая погода|прогноз|покажи погоду)/i.test(cmd)) {
    return { handled: false };
  }

  return null;
}