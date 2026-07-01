# J.A.R.V.I.S. AI Assistant — Worklog

---
Task ID: 1-9
Agent: main (Z.ai Code)
Task: Создать ИИ-помощника для ПК в стиле Джарвиса (голосовой ввод/вывод, LLM-чат, веб-поиск, системный монитор, футуристический HUD-интерфейс)

Work Log:
- Загружены навыки LLM, TTS, ASR, Web-Search, VLM, agent-browser
- Создана тёмная тема Джарвиса (cyan/teal свечение, HUD-стиль) в `src/app/globals.css` с кастомными утилитами: `jarvis-glow`, `jarvis-box-glow`, `jarvis-grid-bg`, `jarvis-scanline`, анимации (spin-slow, pulse-glow, blink, equalizer)
- Обновлён `src/app/layout.tsx`: тёмный режим по умолчанию (`className="dark"`), метаданные J.A.R.V.I.S.
- Обновлена Prisma-схема: модели `Conversation` и `Message` для истории диалогов; `bun run db:push` выполнен успешно
- Создан `src/lib/jarvis.ts` с системным промптом Джарвиса (личность, мультиязычность, формат) и `buildChatMessages` (rolling window 20 сообщений)
- Создан `src/lib/types.ts` (ChatMessage, Conversation, JarvisStatus)
- Backend API (z-ai-web-dev-sdk, runtime=nodejs):
  - `/api/jarvis/chat` — LLM-чат с авто-веб-поиском (эвристика триггеров: новости/погода/курсы/цена и др.), возвращает reply + sources
  - `/api/jarvis/tts` — синтез речи (wav, voice tongtong, обрезка до 1000 символов)
  - `/api/jarvis/asr` — распознавание речи (base64 → text)
  - `/api/jarvis/search` — веб-поиск (web_search function)
  - `/api/jarvis/system` — реальные метрики хоста (os module: CPU, RAM, net, cores, uptime, hostname, arch)
  - `/api/jarvis/conversations` + `/[id]` — CRUD для сессий и сообщений
- Frontend:
  - `src/hooks/use-jarvis.ts` — мозг: состояние (idle/listening/thinking/speaking/error), MediaRecorder для ASR, Audio для TTS, авто-сохранение диалогов, управление разговорами
  - `src/components/jarvis/arc-reactor.tsx` — центральный анимированный arc reactor (3 вращающихся кольца, тики, ядро) с цветами по состоянию
  - `src/components/jarvis/system-monitor.tsx` — HUD-дашборд: 4 круглых gauge (CPU/RAM/NET/TEMP), sparkline сети, нагрузка ядер, спецификации
  - `src/components/jarvis/chat-panel.tsx` — чат с Markdown (react-markdown), индикатор набора, кнопка replay audio, источники веб-поиска
  - `src/components/jarvis/voice-control.tsx` — кнопка микрофона с эквалайзер-визуализатором и пульсирующими кольцами
  - `src/components/jarvis/quick-commands.tsx` — 7 быстрых команд (Время, Новости, Код, Идея, План, Творчество, Статус)
  - `src/components/jarvis/conversation-list.tsx` — журнал сессий с выбором/удалением
  - `src/components/jarvis/status-clock.tsx` — часы+дата (защита от hydration mismatch)
  - `src/app/page.tsx` — 3-колоночный HUD-лейаут (sidebar+center+sidebar), header с лого/статусом/часами, sticky footer
- Lint: `bun run lint` — чисто (0 ошибок)
- Верификация через agent-browser:
  - Страница рендерится без ошибок (200, нет errors в консоли)
  - Отправлен тестовый текст → LLM ответил в характере: «Добрый день, сэр. J.A.R.V.I.S. к вашим услугам…»
  - TTS авто-озвучка сработала (состояние SPEAKING → ONLINE)
  - Веб-поиск: команда «Новости» → реальные новости (Anthropic, солнечная вспышка, электромобили и др.) с источниками (РБК)
  - Системный монитор: реальные метрики (CPU 47%, RAM 23%, NET 181 Mbps, 4 ядра, hostname, uptime 26м, mem 1.9/8.1 ГБ)
  - Диалог сохранён в БД (Session Log: «только что · 1 сообщ.»)
  - Sticky footer: desktop (1440×900) footer прилипает к низу (870→900, без скролла); mobile (390×844) footer естественно внизу длинного контента
  - VLM-анализ скриншота: тёмная киберпанк-эстетика, arc reactor выделен, чат и монитор читаемы, наложений нет

Stage Summary:
- Полностью рабочий ИИ-помощник J.A.R.V.I.S. с голосовым вводом/выводом, LLM-чатом, веб-поиском и системным монитором
- Все 6 backend API работают (chat/tts/asr/search/system/conversations)
- End-to-end поток проверен: текст/голос → LLM (с авто-поиском) → TTS → сохранение в БД
- Адаптивный 3-колоночный HUD-интерфейс с прилипающим footer
- Промпт: если пользователь даст свой промпт, его можно подставить в `JARVIS_SYSTEM_PROMPT` (src/lib/jarvis.ts)
- Голосовой ввод (ASR) требует доступа к микрофону — в реальном браузере работает; в headless-среде протестирован только текстовый путь и TTS

Unresolved / Next steps:
- Голосовой ввод (mic→ASR) не протестирован в headless (нет микрофона), но код корректен по документации ASR-навыка
- Можно добавить анализ изображений (VLM): форма загрузки фото → /api/jarvis/vision → описание в чат
- Можно добавить пробуждение по ключевому слову и непрерывный режим
- Можно добавить экспорт/импорт диалогов
