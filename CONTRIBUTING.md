# Contributing to J.A.R.V.I.S.

Спасибо за интерес к проекту! Этот документ описывает процесс разработки, правила и стандарты кода.

## Быстрый старт

```bash
# Клонировать
git clone https://github.com/Shuguy99/jarvis-ai-beta.git
cd jarvis-ai-beta

# Зависимости
npm install
npx prisma generate
npx prisma db push

# Дев-сервер
npm run dev
```

Открыть http://localhost:3000. Для чата нужен запущенный [Ollama](https://ollama.ai/) с моделью: `ollama pull llama3.1`.

## Стек

| Технология | Версия | Назначение |
|-----------|--------|------------|
| Next.js | 16 (App Router, Turbopack) | Фреймворк |
| React | 19 | UI |
| TypeScript | 5 strict | Типизация |
| Zustand | 5 | State management |
| Tailwind CSS | 4 | Стили |
| Prisma | 6 | SQLite ORM |
| Vitest | 4 | Тесты |
| Electron | 43 | Desktop-приложение |

## Скрипты

```bash
npm run dev          # Дев-сервер (Turbopack)
npm run build        # Production-сборка
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run lint:fix     # ESLint с автофиксом
npm run test         # Vitest (один проход)
npm run test:watch   # Vitest watch-режим
npm run test -- --coverage  # Тесты с покрытием
```

## Структура проекта

```
src/
├── app/                  # Next.js App Router
│   ├── api/jarvis/       # API routes (chat, system, vision, tts...)
│   ├── globals.css       # Глобальные стили + HUD-анимации
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Главная страница (HUD)
├── components/
│   ├── jarvis/           # JARVIS-специфичные компоненты (40+ виджетов)
│   └── ui/               # shadcn/ui базовые компоненты
├── hooks/                # React hooks (19 штук)
├── lib/                  # Логика
│   ├── jarvis-store.ts   # Zustand: чат, диалоги, голос
│   ├── ui-store.ts       # Zustand: панели, виджеты, тема
│   ├── ai-provider.ts    # Провайдеры: Ollama, OpenAI, Anthropic
│   ├── context-bus.ts    # Type-safe event system
│   ├── search-index.ts   # Full-text search
│   └── ...
└── __tests__/            # Vitest тесты
electron/                 # Electron main + preload
prisma/                   # SQLite schema
```

## Правила кода

### TypeScript

- `strict: true` — без исключений
- `noImplicitAny` — обязательно
- `consistent-type-imports` — `import type { X }` для типов
- `prefer-as-const` — использовать `as const` где возможно

### React

- `react-hooks/exhaustive-deps` — полные зависимости в useEffect/useMemo
- `react-hooks/purity` — чистые рендеры (React 19 compiler)
- `react-hooks/set-state-in-effect` — стейт-обновления в эффектах
- Модульного уровня константы вместо `Math.random()` в хуках (React 19 strict mode)
- `React.lazy()` + `JarvisSuspense` для code-splitting тяжелых виджетов

### Качество

- `eqeqeq` — строгое равенство (`===`)
- `prefer-const` — `const` по умолчанию
- `curly` — фигурные скобки для многострочных блоков
- `no-console` — только `console.warn` и `console.error`

## Написание тестов

Тесты находятся в `src/__tests__/`. Конфиг: `vitest.config.ts`.

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("module-name", () => {
  beforeEach(() => {
    // сброс состояния
  });

  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### Покрытие

```bash
npm run test -- --coverage
```

Отчёт генерируется в `coverage/`. Целевые директории: `src/lib/`, `src/hooks/`, `src/components/jarvis/`.

## Коммиты

Формат: `type(scope): description`

- `feat(hud): add new widget`
- `fix(chat): resolve streaming issue`
- `refactor(store): extract ui-store`
- `test(lib): add context-bus tests`
- `docs: update CONTRIBUTING.md`
- `chore: bump dependencies`

## PR процесс

1. Форкнуть репозиторий
2. Создать feature-ветку от `main`
3. Убедиться что проходят: `npm run typecheck && npm run lint && npm run test`
4. Открыть Pull Request в `main`

## Архитектурные решения

- **Zustand** вместо Redux — меньше бойлерплейта, сериализуемый стейт
- **Pub/Sub** (`context-bus.ts`) вместо prop drilling — виджеты общаются через события
- **Shared poller** (`use-system-poller.ts`) — один интервал на все виджеты системного мониторинга
- **Pure CSS visualizer** в music-player — нет rAF/AudioContext, только `@keyframes`
- **Body limit guard** (`body-limit.ts`) — защита API routes от перегрузки

## Получение помощи

Открыть Issue на GitHub с меткой `question` или `bug`.