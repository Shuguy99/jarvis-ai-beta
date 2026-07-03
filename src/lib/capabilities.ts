// ============================================================
// JARVIS Capabilities — Static data extracted from page.tsx
// ============================================================

import {
  Brain, Volume2, Eye, Monitor, Rocket, Target,
  CloudSun, Activity, Network, ShieldAlert, Terminal,
  Headphones, FolderOpen, CalendarDays, FileCode, Bot,
  Puzzle, LayoutGrid, Search, Bell, Sparkles, TrendingUp,
  Command, Mic, FileText, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Capability {
  icon: LucideIcon;
  label: string;
  desc: string;
}

export const CAPABILITIES: Capability[] = [
  { icon: Brain, label: "Reasoning", desc: "LLM-диалог и анализ" },
  { icon: Volume2, label: "Voice I/O", desc: "Распознавание + синтез" },
  { icon: Eye, label: "Vision", desc: "Анализ изображений" },
  { icon: Monitor, label: "Screen", desc: "Захват экрана + VLM" },
  { icon: Rocket, label: "Launch", desc: "Быстрый доступ" },
  { icon: Target, label: "Focus", desc: "Pomodoro таймер" },
  { icon: CloudSun, label: "Weather", desc: "Погода в реальном" },
  { icon: Activity, label: "Events", desc: "Лог активности" },
  { icon: Network, label: "Network", desc: "Мониторинг трафика" },
  { icon: ShieldAlert, label: "Health", desc: "Мониторинг систем" },
  { icon: Bell, label: "Alerts", desc: "Уведомления HUD" },
  { icon: Terminal, label: "Processes", desc: "Монитор процессов" },
  { icon: Headphones, label: "Ambient", desc: "Фоновые звуки" },
  { icon: FolderOpen, label: "Files", desc: "Проводник файлов" },
  { icon: CalendarDays, label: "Calendar", desc: "Календарь + события" },
  { icon: FileCode, label: "Markdown", desc: "Редактор Markdown" },
  { icon: Command, label: "Voice CMD", desc: "Голосовые команды" },
  { icon: Bot, label: "Agent", desc: "Автономный ИИ-агент" },
  { icon: Puzzle, label: "Plugins", desc: "Система расширений" },
  { icon: LayoutGrid, label: "Layout", desc: "Настройка раскладки" },
  { icon: Search, label: "Search++", desc: "Глобальный поиск" },
  { icon: Bell, label: "Notif Center", desc: "Центр уведомлений" },
  { icon: Sparkles, label: "Insights", desc: "AI-анализ системы" },
  { icon: TrendingUp, label: "Metrics", desc: "История метрик" },
  { icon: Command, label: "DnD", desc: "Перетаскивание" },
];

export const DIRECTIVES: { num: string; text: string }[] = [
  { num: "01.", text: "Голосовой ввод — нажмите микрофон и говорите." },
  { num: "02.", text: "Авто-озвучка + кнопка повтора для каждого ответа." },
  { num: "03.", text: "Веб-поиск автоматически для новостей, погоды, курсов." },
  { num: "04.", text: "Загрузите или перетащите изображение для анализа." },
  { num: "05.", text: "Генерация изображений — кнопки «Создай картинку» / «Арт»." },
  { num: "06.", text: "Смените костюм — переключатель тем Mark 1/42/50." },
  { num: "07.", text: "Экспорт диалогов — кнопка EXPORT в шапке чата." },
  { num: "08.", text: "Заметки, таймер, команды — Ctrl+K для палитры." },
  { num: "09.", text: "Say \"Hey Jarvis\" — wake word activation." },
  { num: "10.", text: "Screen Capture — покажите экран + задайте вопрос." },
  { num: "11.", text: "Weather + Music + Clipboard + World Clock." },
  { num: "12.", text: "Continuous Listen — Auto-Listen режим." },
  { num: "13.", text: "Quick Launch — быстрые ссылки по категориям." },
  { num: "14.", text: "Pomodoro Focus — режим концентрации 25/5." },
  { num: "15.", text: "Network Traffic — мониторинг сети в реальном времени." },
  { num: "16.", text: "System Health — пороговые алерты и диагностика." },
  { num: "17.", text: "HUD Notifications — всплывающие уведомления." },
  { num: "18.", text: "Enhanced Notes — категории, поиск, закрепление." },
  { num: "19.", text: "Code Highlighting — подсветка + копирование блоков." },
  { num: "20.", text: "Quick Actions Bar — быстрые действия внизу." },
  { num: "21.", text: "Session Stats — аналитика использования." },
  { num: "22.", text: "Keyboard Shortcuts — справка по хоткеям." },
  { num: "23.", text: "Process Monitor — список и завершение процессов." },
  { num: "24.", text: "Ambient Sound — атмосферные звуки (Web Audio)." },
  { num: "25.", text: "Image Drag & Drop — перетащите фото в чат." },
  { num: "26.", text: "File Explorer — навигация по файловой системе." },
  { num: "27.", text: "Calendar — мини-календарь с событиями." },
  { num: "28.", text: "Markdown Editor — редактор с предпросмотром." },
  { num: "29.", text: "Unified Poller — оптимизация системных запросов." },
  { num: "30.", text: "Desktop Mode — Electron shell, tray, window controls." },
  { num: "31.", text: "Voice Commands — NLP-парсер для прямых команд." },
  { num: "32.", text: "AI Agent — автономный режим с пошаговым выполнением." },
  { num: "33.", text: "Plugin System — расширения и модули." },
  { num: "34.", text: "Layout Config — настройка раскладки и пресеты." },
  { num: "35.", text: "Notification Center — история и правила алертов." },
  { num: "36.", text: "Metrics History — график CPU/RAM/Network за 5 мин." },
  { num: "37.", text: "Widget DnD — перетаскивание виджетов (инфраструктура)." },
  { num: "38.", text: "Performance — React.memo + lazy loading оверлеев." },
  { num: "39.", text: "Accessibility — ARIA utils и focus trap." },
  { num: "40.", text: "Bugfix — Processes API locale, React key collision." },
  { num: "41.", text: "Proactive Engine — фоновый мониторинг с контекстными уведомлениями." },
  { num: "42.", text: "Context Bus — шина событий для корреляции между модулями." },
  { num: "43.", text: "Electron+ — protocol handler, autostart, window state persistence." },
];