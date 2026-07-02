# J.A.R.V.I.S. — AI Assistant

Tony Stark HUD-стиль интерфейс ИИ-ассистента. Работает полностью **локально** на Windows 11 64-bit без каких-либо API ключей.

![J.A.R.V.I.S.](https://img.shields.io/badge/J.A.R.V.I.S.-AI%20Assistant-00d4ff?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Ollama](https://img.shields.io/badge/Ollama-Local_AI-000?style=flat-square&logo=ollama)

## Возможности

- 💬 **Чат с ИИ** — через Ollama (бесплатный локальный LLM)
- 👁 **Анализ изображений** — через vision-модели Ollama (llava)
- 🎙 **Голосовой ввод** — через микрофон браузера (Web Speech API)
- 🔊 **Озвучка ответов** — через синтез речи браузера
- 🧠 **Настройки модели поведения** — 6 пресетов персон, формальность, юмор, стиль ответов, кастомный промт
- 📝 **Заметки и TODO** — локальное хранение
- ⏱ **Таймер / Секундомер**
- 🖥 **HUD интерфейс** — в стиле JARVIS из Железного Человека
- ⌨ **Командная палитра** — `Ctrl+K`
- 🎨 **Тёмная/светлая тема** + цветовые схемы (MARK 1 / 42 / 50)
- 📂 **История диалогов** — сохраняется в SQLite
- 🌐 **Мониторинг системы** — CPU, RAM, сеть в реальном времени

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

### 2. Установите Node.js или Bun

**Вариант A — Node.js (рекомендуется для новичков):**
Скачайте с [nodejs.org](https://nodejs.org) (LTS версию).

**Вариант B — Bun (быстрее):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 3. Клонируйте и запустите

```powershell
git clone https://github.com/Shuguy99/jarvis-ai-beta.git
cd jarvis-ai-beta

# Установите зависимости
npm install

# Настройте базу данных и сгенерируйте Prisma клиент
npx prisma generate
npx prisma db push

# Запустите!
npm run dev
```

Откройте **http://localhost:3000** в браузере (рекомендуется **Google Chrome**).

## Настройка поведения JARVIS

Нажмите кнопку **«Настройки»** (⚙️) в интерфейсе. Две вкладки:

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

### 🔊 Голос и система
- Скорость, тон и громкость TTS
- Авто-озвучка ответов
- Язык интерфейса (RU/EN)

## Переменные окружения (опционально)

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

## Рекомендуемые модели Ollama

| Модель | RAM | Назначение | Установка |
|--------|-----|------------|-----------|
| `llama3.1` | 4.7 GB | Чат (по умолчанию) | `ollama pull llama3.1` |
| `qwen2.5:7b` | 4.4 GB | Чат, лучший русский | `ollama pull qwen2.5:7b` |
| `mistral` | 4.1 GB | Чат, быстрый | `ollama pull mistral` |
| `phi3` | 2.3 GB | Лёгкий чат | `ollama pull phi3` |
| `llava` | 4.7 GB | Анализ изображений | `ollama pull llava` |

## Голосовой ввод

Работает через **Web Speech API** браузера:
- ✅ **Google Chrome** — полная поддержка
- ⚠️ **Microsoft Edge** — может работать
- ❌ **Firefox** — не поддерживается

## Структура проекта

```
src/
├── app/
│   ├── api/jarvis/     # API-маршруты (chat, vision, settings, notes, etc.)
│   ├── globals.css     # Стили JARVIS HUD (cyan neon cyberpunk)
│   ├── layout.tsx      # Корневой layout
│   └── page.tsx        # Главная страница (3-колоночный HUD)
├── components/
│   ├── jarvis/         # JARVIS-компоненты (arc-reactor, chat, voice, settings, etc.)
│   └── ui/             # Базовые UI-компоненты (shadcn/ui)
├── hooks/
│   └── use-jarvis.ts   # Основной хук JARVIS (состояние, голос, TTS)
└── lib/
    ├── ai-provider.ts  # Провайдер ИИ (Ollama, OpenAI-совместимый API)
    ├── db.ts           # Prisma клиент (SQLite)
    ├── jarvis.ts       # Динамический системный промпт + пресеты
    ├── sounds.ts       # Звуковые эффекты (Web Audio API)
    ├── types.ts        # TypeScript типы
    └── utils.ts        # Утилиты (cn, etc.)
prisma/
└── schema.prisma       # БД схема (Conversation, Message, Note, Setting)
```

## Статус функций

| Функция | Статус | Примечание |
|---------|--------|------------|
| Чат с ИИ | ✅ | Через Ollama (любая модель) |
| Настройки поведения | ✅ | 6 пресетов + кастомный промт |
| Анализ изображений | ✅ | Нужна модель llava |
| Голосовой ввод | ✅ | Chrome Web Speech API |
| Озвучка ответов | ✅ | Браузерный SpeechSynthesis |
| Заметки / TODO | ✅ | SQLite |
| Таймер | ✅ | — |
| Системный монитор | ✅ | CPU, RAM, сеть |
| История диалогов | ✅ | SQLite + экспорт |
| Командная палитра | ✅ | Ctrl+K |
| Веб-поиск | ❌ | Нужен внешний API |
| Генерация картинок | ❌ | Нужен DALL-E / SD API |

## Технологии

- **Next.js 16** (App Router, Turbopack)
- **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui**
- **Prisma** + **SQLite**
- **Framer Motion** — анимации
- **Ollama** — локальный LLM (OpenAI-совместимый API)

## Решение проблем

**Ollama не запускается:**
- Убедитесь, что Ollama установлен и запущен (значок в трее)
- Проверьте: `ollama list` в терминале
- Перезапустите Ollama

**Ошибка `ECONNREFUSED` при отправке сообщения:**
- Ollama не запущен. Запустите его и попробуйте снова.

**Голос не работает:**
- Используйте Google Chrome
- Проверьте разрешения микрофона в настройках браузера

**Модель отвечает медленно:**
- Попробуйте модель поменьше (`phi3`, `mistral`)
- Закройте другие ресурсоёмкие приложения

## Лицензия

MIT