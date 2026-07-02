# J.A.R.V.I.S. — AI Assistant

Tony Stark HUD-стиль интерфейс ИИ-ассистента. Работает полностью **локально** на Windows 11 64-bit без каких-либо API ключей.

![JARVIS HUD](https://img.shields.io/badge/J.A.R.V.I.S.-AI%20Assistant-00d4ff?style=for-the-badge)

## Возможности

- 💬 **Чат с ИИ** — через Ollama (бесплатный локальный LLM)
- 👁 **Анализ изображений** — через vision-модели Ollama (llava)
- 🎙 **Голосовой ввод** — через микрофон браузера (Web Speech API)
- 🔊 **Озвучка ответов** — через синтез речи браузера
- 📝 **Заметки и TODO** — локальное хранение
- ⏱ **Таймер / Секундомер**
- 🖥 **HUD интерфейс** — в стиле JARVIS из Железного Человека
- ⌨ **Командная палитра** — Ctrl+K
- 🎨 **Тёмная/светлая тема**
- 📂 **История диалогов** — сохраняется в SQLite

## Системные требования

- **Windows 11** 64-bit (или Windows 10, macOS, Linux)
- **Node.js** 18+ или **Bun** 1.0+
- **Ollama** — [скачать с ollama.com](https://ollama.com)

## Установка

### 1. Установите Ollama

Скачайте и установите [Ollama](https://ollama.com/download) для Windows.

После установки откройте терминал и скачайте модель:

```powershell
# Основная модель для чата (~4.7 GB)
ollama pull llama3.1

# Опционально: модель для анализа изображений (~4.7 GB)
ollama pull llava
```

### 2. Клонируйте и настройте проект

```powershell
git clone https://github.com/Shuguy99/jarvis-ai-beta.git
cd jarvis-ai-beta

# Установите зависимости
npm install
# или: bun install

# Настройте базу данных
npx prisma generate
npx prisma db push
# или: bun run setup
```

### 3. Запустите

```powershell
npm run dev
# или: bun run dev
```

Откройте **http://localhost:3000** в браузере (рекомендуется Chrome).

## Переменные окружения (опционально)

Создайте файл `.env` в корне проекта:

```env
# URL Ollama (по умолчанию: http://localhost:11434/v1)
OLLAMA_BASE_URL=http://localhost:11434/v1

# Модель для чата (по умолчанию: llama3.1)
OLLAMA_MODEL=llama3.1

# Модель для анализа изображений (по умолчанию: llava)
OLLAMA_VISION_MODEL=llava
```

## Рекомендуемые модели

| Модель | Размер | Назначение | Команда |
|--------|--------|------------|---------|
| `llama3.1` | 4.7 GB | Чат (по умолчанию) | `ollama pull llama3.1` |
| `llama3.1:8b` | 4.7 GB | Чат, улучшенная | `ollama pull llama3.1:8b` |
| `qwen2.5:7b` | 4.4 GB | Чат, хорошо знает русский | `ollama pull qwen2.5:7b` |
| `llava` | 4.7 GB | Анализ изображений | `ollama pull llava` |
| `llama3.1:70b` | 40 GB | Максимальное качество | `ollama pull llama3.1:70b` |

> 💡 Для лучшей работы с русским языком попробуйте `qwen2.5:7b` — она лучше понимает и генерирует русский текст.

## Голосовой ввод

Голосовой ввод работает через **Web Speech API** браузера:
- ✅ **Google Chrome** — полная поддержка
- ⚠️ **Microsoft Edge** — может работать
- ❌ **Firefox** — не поддерживается

## Структура проекта

```
src/
├── app/
│   ├── api/jarvis/     # API-маршруты (chat, vision, tts, asr, notes, etc.)
│   ├── globals.css     # Стили JARVIS HUD
│   ├── layout.tsx      # Корневой layout
│   └── page.tsx        # Главная страница (3-колоночный HUD)
├── components/
│   ├── jarvis/         # JARVIS-компоненты (arc-reactor, chat, voice, etc.)
│   └── ui/             # Базовые UI-компоненты (shadcn/ui)
├── hooks/
│   └── use-jarvis.ts   # Основной хук JARVIS
└── lib/
    ├── ai-provider.ts  # Провайдер ИИ (Ollama)
    ├── db.ts           # Prisma клиент
    ├── jarvis.ts       # Системный промпт JARVIS
    ├── sounds.ts       # Звуковые эффекты
    ├── types.ts        # TypeScript типы
    └── utils.ts        # Утилиты
```

## Ограничения локального режима

| Функция | Статус | Примечание |
|---------|--------|------------|
| Чат с ИИ | ✅ Работает | Через Ollama |
| Анализ изображений | ✅ Работает | Нужна модель llava |
| Голосовой ввод | ✅ Работает | Chrome |
| Озвучка ответов | ✅ Работает | Браузерный TTS |
| Заметки / TODO | ✅ Работает | SQLite |
| Таймер | ✅ Работает | — |
| Веб-поиск | ❌ Недоступен | Нужен внешний API |
| Генерация картинок | ❌ Недоступна | Нужен DALL-E / SD API |

## Технологии

- **Next.js 16** — React фреймворк
- **TypeScript** — типизация
- **Tailwind CSS 4** — стили
- **Prisma + SQLite** — база данных
- **Framer Motion** — анимации
- **Ollama** — локальный LLM
- **Web Speech API** — голос

## Лицензия

MIT