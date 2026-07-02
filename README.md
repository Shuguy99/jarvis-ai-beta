# J.A.R.V.I.S. — Just A Rather Very Intelligent System

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square&logo=prisma" alt="Prisma">
</p>

AI-помощник в стиле JARVIS из Iron Man — полноэкранное desktop-приложение с HUD-интерфейсом, голосовым вводом/выводом, чатом с LLM, генерацией и анализом изображений.

## ✨ Возможности

- 🧠 **LLM-чат** — диалог с ИИ (OpenAI GPT-4o-mini, Ollama, Groq и др.)
- 🎤 **Голосовой ввод** — распознавание речи через браузер (Chrome)
- 🔊 **Озвучка ответов** — синтез речи на русском языке (браузерный TTS)
- 👁 **Анализ изображений** — загрузите фото, JARVIS опишет его
- 🎨 **Генерация картинок** — DALL-E 3 / совместимые модели
- 🌐 **Веб-поиск** — автоматический для новостей, погоды, курсов (опционально)
- 📊 **Системный монитор** — CPU, RAM, сеть в реальном времени
- 📝 **Заметки и таймер** — голосовые команды для быстрого создания
- ⌨ **Горячие клавиши** — Ctrl+K командная строка, Ctrl+M микрофон
- 🎯 **3 темы** — Mark 1 (cyan), Mark 42 (gold), Mark 50 (red)
- 💾 **История диалогов** — сохраняется в локальную SQLite базу
- 🔊 **Звуковые эффекты** — синтезированные UI-звуки через Web Audio API
- ⌨️ **Typewriter-эффект** — ответы печатаются посимвольно

## 🚀 Быстрый старт

### Требования
- [Node.js](https://nodejs.org/) 18+ или [Bun](https://bun.sh/)
- [Git](https://git-scm.com/)
- Chrome (для голосового ввода)
- OpenAI API ключ (или совместимый сервис)

### Установка

```bash
# 1. Клонировать
git clone https://github.com/Shuguy99/jarvis-ai-beta.git
cd jarvis-ai-beta

# 2. Установить зависимости
bun install
# или: npm install

# 3. Настроить переменные окружения
cp .env.example .env
```

### Настройка `.env`

Откройте `.env` и вставьте свой API-ключ:

```env
# Обязательное — получите на https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-key-here

# Опционально — другие провайдеры
# OPENAI_BASE_URL=http://localhost:11434/v1  # Ollama
# OPENAI_BASE_URL=https://api.groq.com/openai/v1  # Groq
```

### Запуск

```bash
# Создать базу данных
bun run db:push
# или: npx prisma db push

# Запустить dev-сервер
bun run dev
# или: npm run dev
```

Откройте **http://localhost:3000** в Chrome. Нажмите **F11** для полноэкранного режима.

## 🎮 Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl + Enter` | Отправить сообщение |
| `Shift + Enter` | Перенос строки |
| `Escape` | Остановить речь / отмена |
| `Ctrl + K` | Командная строка |
| `Ctrl + M` | Микрофон вкл/выкл |
| `Ctrl + N` | Новый диалог |
| `F11` | Полноэкранный режим |

## 🎨 Темы

- **Mark I** — классический cyan (по умолчанию)
- **Mark 42** — золотой (Iron Man Mk 42)
- **Mark 50** — красный (纳米装甲)

## 🔧 Совместимые AI-провайдеры

JARVIS работает с любым OpenAI-совместимым API:

| Провайдер | `OPENAI_BASE_URL` | Модель |
|-----------|-------------------|--------|
| OpenAI | *(по умолчанию)* | `gpt-4o-mini` |
| Ollama (локально) | `http://localhost:11434/v1` | `llama3`, `mistral` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| LM Studio | `http://localhost:1234/v1` | любая загруженная |
| OpenRouter | `https://openrouter.ai/api/v1` | любая |

## 📁 Структура

```
src/
├── app/
│   ├── page.tsx              # HUD-интерфейс (3 колонки)
│   ├── globals.css           # Тема + JARVIS CSS-утилиты
│   └── api/jarvis/           # Backend API
│       ├── chat/             # LLM-чат
│       ├── vision/           # Анализ изображений
│       ├── image-gen/        # Генерация картинок
│       ├── search/           # Веб-поиск
│       ├── tts/              # Озвучка
│       ├── asr/              # Распознавание речи
│       ├── system/           # Системные метрики
│       └── conversations/    # CRUD диалогов
├── components/jarvis/        # HUD-компоненты
├── hooks/use-jarvis.ts       # Главный state-хук
└── lib/
    ├── ai-provider.ts        # Абстракция AI-провайдера
    ├── jarvis.ts             # Системный промпт
    └── sounds.ts             # Звуковые эффекты
```

## 📝 Лицензия

MIT — свободно использовать и модифицировать.

---

<p align="center">
  <sub>Built with ❤️ · Powered by Z.ai neural core</sub>
</p>