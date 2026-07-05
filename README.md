# J.A.R.V.I.S. — AI Desktop Assistant

Tony Stark HUD-стиль интерфейс ИИ-ассистента. Нативное **десктоп-приложение** на Electron — браузер не нужен. Работает полностью **локально** без каких-либо API ключей.

![J.A.R.V.I.S.](https://img.shields.io/badge/J.A.R.V.I.S.-AI%20Assistant-00d4ff?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite)
![Electron](https://img.shields.io/badge/Electron-43-47848f?style=flat-square&logo=electron)
![Hono](https://img.shields.io/badge/Hono-API-e3602b?style=flat-square)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Ollama](https://img.shields.io/badge/Ollama-Local_AI-000?style=flat-square&logo=ollama)

## Возможности

- 🖥 **Десктоп-приложение** — Electron, запуск без браузера, сворачивание в трей
- 💬 **Чат с ИИ** — 5 провайдеров: Ollama, OpenAI, Anthropic, Gemini, OpenRouter
- 👁 **Анализ изображений** — vision-модели (llava, GPT-4o, Claude и др.)
- 🎙 **Голосовой ввод** — Web Speech API
- 🔊 **Озвучка ответов** — синтез речи (TTS)
- 🧠 **Настройки модели поведения** — 6 пресетов персон, формальность, юмор, стиль ответов, кастомный промт
- 📝 **Заметки и TODO** — локальное хранение в SQLite
- ⏱ **Таймер / Секундомер / Помодоро**
- 🖥 **HUD интерфейс** — в стиле JARVIS из Железного Человека
- ⌨ **Командная палитра** — `Ctrl+K`
- 🎨 **Темы** — тёмная/светлая + 3 встроенные цветовые схемы (MARK 1/42/50) + кастомный редактор тем
- 📂 **История диалогов** — SQLite, экспорт в JSON
- 🌐 **Мониторинг системы** — CPU, RAM, сеть в реальном времени
- 🔍 **RAG-поиск по контексту** — FTS5 + BM25 ранжирование
- 🤖 **Агент-система** — инструменты ИИ-агента (веб-поиск, файлы, GitHub, погода, калькулятор)
- 🧩 **Плагин-система** — расширение функциональности через плагины
- ⚡ **Rate limiting** — защита API от перегрузки (sliding window)
- 🪟 **Управление окном** — прозрачность, поверх всех окон, полный экран, автосохранение позиции
- 🔗 **Протокол jarvis://** — глубокие ссылки на функции JARVIS
- ⌨ **Горячие клавиши** — `Ctrl+Shift+J` — показать/скрыть окно из любого места

## Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| **ОС** | Windows 10 64-bit | Windows 11 64-bit |
| **CPU** | 4 ядра | 8+ ядер (Ryzen 7 / i7) |
| **RAM** | 8 GB | 16 GB+ |
| **GPU** | Любая | Для vision-моделей: 8GB+ VRAM |
| **Диск** | ~10 GB свободно | SSD рекомендуется |

### Рекомендации по моделям под ваше железо

**Ryzen 7 5700G (8 ядер, 16GB RAM, Vega 17):**
- ✅ `llama3.1` / `qwen2.5:7b` — отлично работают на CPU (~15-30 tok/s)
- ✅ `llava` — анализ изображений на CPU (медленнее, но работает)
- ⚠️ Модели 13B+ — будут работать, но медленнее

> 💡 Для лучшего опыта с русским языком рекомендую `qwen2.5:7b` — лучше понимает и генерирует русский.

## Быстрая установка (Windows)

### 1. Установите Ollama

Скачайте установщик с [ollama.com/download](https://ollama.com/download) и запустите.

После установки откройте **PowerShell** или **Командную строку**:

```powershell
# Основная модель для чата (~4.7 GB)
ollama pull llama3.1

# Опционально: модель для анализа изображений (~4.7 GB)
ollama pull llava
```

> Убедитесь, что Ollama запущен (значок в трее). Проверить: `ollama list`

### 2. Установите Node.js

Скачайте с [nodejs.org](https://nodejs.org) (LTS версию).

### 3. Клонируйте и запустите

```powershell
git clone https://github.com/Shuguy99/jarvis-ai-beta.git
cd jarvis-ai-beta

# Установите зависимости
npm install

# Настройте базу данных и сгенерируйте Prisma клиент
npm run setup

# Запустите веб-версию (Vite + Hono)
npm run dev
```

Откройте **http://localhost:5173** в браузере.

### 4. Десктоп-приложение (Electron)

```powershell
# Запуск в режиме разработки (Vite + Hono + Electron)
npm run electron:dev

# Сборка установщика Windows
npm run electron:build
```

При сборке создаётся `.exe` установщик в папке `dist-electron/`.

## Режимы запуска

| Команда | Режим | Описание |
|---------|-------|----------|
| `npm run dev` | Веб | Vite dev-server (порт 5173) + Hono API (порт 3001) |
| `npm run electron:dev` | Десктоп | Vite + Hono + Electron окно |
| `npm run electron:build` | Сборка | Собираёт установщик для Windows/macOS/Linux |
| `npm run electron:preview` | Превью | Собираёт и запускает без установщика |
| `npm test` | Тесты | Запуск всех тестов (Vitest) |

## AI-провайдеры

JARVIS поддерживает 5 провайдеров. Настройте через интерфейс (⚙️ Настройки → Провайдеры):

| Провайдер | Требует API-ключ | Описание |
|-----------|-------------------|----------|
| **Ollama** | Нет | Локальный LLM, работает без интернета |
| **OpenAI** | Да | GPT-4o, GPT-4, GPT-3.5 и др. |
| **Anthropic** | Да | Claude 4, Claude 3.5 и др. |
| **Gemini** | Да | Google Gemini Pro / Flash |
| **OpenRouter** | Да | Единый API к 200+ моделям |

## Настройка поведения JARVIS

Нажмите кнопку **«Настройки»** (⚙️) в интерфейсе.

### 🧠 Модель поведения
| Параметр | Описание |
|----------|----------|
| **Персона** | 6 пресетов: Classic JARVIS, Military Mode, Casual Buddy, Dr. JARVIS, Creative Muse, Custom |
| **Имя пользователя** | Как JARVIS к вам обращается (по умолчанию — «сэр») |
| **Формальность** | 0 (неформально) → 1 (строго официально) |
| **Юмор** | 0 (серьёзно) → 1 (остроумно) |
| **Стиль ответов** | Кратко / Стандарт / Подробно / Технично |
| **Температура** | 0 (точно) → 2 (креативно) — управляет вариативностью ИИ |
| **Макс. токенов** | Длина ответа: 256 — 8192 |
| **Окно контекста** | Сколько сообщений помнит: 4 — 50 |
| **Кастомный промт** | Полностью переопределяет личность JARVIS |

### 🎨 Темы
- 3 встроенные схемы: **MARK 1** (cyan), **MARK 42** (red/gold), **MARK 50** (nanotech blue)
- Тёмная / светлая тема
- **Кастомный редактор тем** — настройка цветов, прозрачности, скруглений
- Темы сохраняются в localStorage

### 🔊 Голос и система
- Скорость, тон и громкость TTS
- Авто-озвучка ответов
- Язык интерфейса (RU/EN)

## Переменные окружения

Скопируйте `.env.example` как `.env`:

```powershell
copy .env.example .env
```

```env
DATABASE_URL=file:./db/jarvis.db
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llava
```

Для облачных провайдеров добавьте API-ключи:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
```

## Рекомендуемые модели Ollama

| Модель | RAM | Назначение | Установка |
|--------|-----|------------|-----------|
| `llama3.1` | 4.7 GB | Чат (по умолчанию) | `ollama pull llama3.1` |
| `qwen2.5:7b` | 4.4 GB | Чат, лучший русский | `ollama pull qwen2.5:7b` |
| `mistral` | 4.1 GB | Чат, быстрый | `ollama pull mistral` |
| `phi3` | 2.3 GB | Лёгкий чат | `ollama pull phi3` |
| `llava` | 4.7 GB | Анализ изображений | `ollama pull llava` |

## Структура проекта

```
├── electron/                # Electron — десктоп-обёртка
│   ├── src/
│   │   ├── main.ts          # Главный процесс (окно, трей, IPC)
│   │   └── preload.ts       # Preload-скрипт (context bridge)
│   └── resources/           # Иконки для сборки
├── server/                  # Hono — бэкенд API
│   ├── index.ts             # Все 25 API-маршрутов
│   └── tsconfig.json
├── src/                     # React-фронтенд (Vite)
│   ├── app/
│   │   ├── api/jarvis/      # Legacy Next.js маршруты (не используются)
│   │   ├── globals.css      # Стили JARVIS HUD (cyan neon cyberpunk)
│   │   ├── layout.tsx       # Корневой layout
│   │   └── page.tsx         # Главная страница (3-колоночный HUD)
│   ├── components/
│   │   ├── jarvis/          # 57 JARVIS-компонентов
│   │   └── ui/              # Базовые UI-компоненты (shadcn/ui)
│   ├── hooks/               # 17 хуков (чат, голос, DnD, горячие клавиши)
│   ├── lib/                 # Модули (AI-провайдер, БД, темы, RAG, rate limit)
│   └── __tests__/           # 15 тест-файлов (271 тест)
├── prisma/
│   └── schema.prisma        # БД схема (Conversation, Message, Note, Setting)
├── scripts/
│   └── setup-fts5.js        # Настройка FTS5 для полнотекстового поиска
├── index.html               # Vite entry point
├── vite.config.ts           # Vite конфигурация
└── vitest.config.ts         # Тест-раннер конфигурация
```

## Статус функций

| Функция | Статус | Примечание |
|---------|--------|------------|
| Десктоп-приложение (Electron) | ✅ | Трей, прозрачность, автосохранение позиции окна |
| Чат с ИИ | ✅ | 5 провайдеров (Ollama, OpenAI, Anthropic, Gemini, OpenRouter) |
| Настройки поведения | ✅ | 6 пресетов + кастомный промт |
| Анализ изображений | ✅ | Vision-модели любого провайдера |
| Голосовой ввод | ✅ | Web Speech API |
| Озвучка ответов | ✅ | SpeechSynthesis |
| Заметки / TODO | ✅ | SQLite |
| Таймер / Помодоро | ✅ | — |
| Системный монитор | ✅ | CPU, RAM, сеть, история метрик |
| История диалогов | ✅ | SQLite + экспорт в JSON |
| Командная палитра | ✅ | Ctrl+K |
| RAG-поиск | ✅ | FTS5 + BM25 ранжирование |
| Агент-система | ✅ | Веб-поиск, файлы, GitHub, погода, калькулятор |
| Плагин-система | ✅ | Расширяемость через плагины |
| Темы | ✅ | 3 схемы + кастомный редактор + localStorage |
| Rate limiting | ✅ | Защита 6 эндпоинтов (sliding window) |
| Протокол jarvis:// | ✅ | Глубокие ссылки |
| Горячие клавиши | ✅ | Ctrl+Shift+J — показать/скрыть |
| Веб-поиск | ❌ | Нужен внешний API |
| Генерация картинок | ❌ | Нужен DALL-E / SD API |

## Технологии

- **Vite 7** — сборка фронтенда
- **React 19** + **TypeScript 5** (strict mode)
- **Hono** — бэкенд API (заменяет Next.js API routes)
- **Electron 43** — десктоп-обёртка
- **Tailwind CSS 4** + **shadcn/ui** — UI
- **Prisma** + **SQLite** (FTS5) — база данных
- **Framer Motion** — анимации
- **Zustand** — управление состоянием
- **Vitest** — тестирование (271 тест)
- **Ollama** — локальный LLM (OpenAI-совместимый API)

## Тестирование

```powershell
# Запустить все тесты
npm test

# Тесты в режиме watch
npm run test:watch
```

271 тест покрывают: API-маршруты, агент-систему, плагины, rate limiting, темы, хуки, UI-компоненты.

## Сборка десктоп-приложения

```powershell
# Windows (NSIS установщик)
npm run electron:build

# Результат: dist-electron/JARVIS-AI-19.0.0-win-x64-setup.exe
```

Поддерживаемые платформы:
- **Windows** — NSIS установщик (.exe)
- **macOS** — DMG (x64 + ARM64)
- **Linux** — AppImage + .deb

## Решение проблем

**Ollama не запускается:**
- Убедитесь, что Ollama установлен и запущен (значок в трее)
- Проверьте: `ollama list` в терминале
- Перезапустите Ollama

**Ошибка `ECONNREFUSED` при отправке сообщения:**
- Ollama не запущен. Запустите его и попробуйте снова.
- При использовании Electron: убедитесь, что Hono сервер запущен (порт 3001)

**Electron не запускается:**
- Убедитесь, что `npm run dev` работает (Vite + Hono)
- Проверьте логи в консоли Electron (Ctrl+Shift+I)
- Для сборки установщика нужен `electron-builder`

**Голос не работает:**
- В веб-режиме: используйте Google Chrome
- Проверьте разрешения микрофона

**Модель отвечает медленно:**
- Попробуйте модель поменьше (`phi3`, `mistral`)
- Закройте другие ресурсоёмкие приложения

## Лицензия

MIT