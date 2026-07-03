import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

console.log('JARVIS Electron starting...');

let mainWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isAlwaysOnTop = false;
let currentOpacity = 1.0;
let isOnline = false;

const isDev = !app.isPackaged;
const NEXT_PORT = 3000;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;

// ─── Window State Persistence ─────────────────────────────────────────────
// Сохранение позиции и размера окна между запусками

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1600,
  height: 900,
  isMaximized: false,
};

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'jarvis-window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const filePath = getWindowStateFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WindowState>;
      // Валидация: проверяем, что размеры в разумных пределах
      if (
        typeof parsed.width === 'number' && parsed.width >= 1200 &&
        typeof parsed.height === 'number' && parsed.height >= 700
      ) {
        return {
          x: typeof parsed.x === 'number' ? parsed.x : undefined,
          y: typeof parsed.y === 'number' ? parsed.y : undefined,
          width: parsed.width,
          height: parsed.height,
          isMaximized: typeof parsed.isMaximized === 'boolean' ? parsed.isMaximized : false,
        };
      }
    }
  } catch (err) {
    console.warn('[JARVIS] Не удалось загрузить состояние окна:', (err as Error).message);
  }
  return { ...DEFAULT_WINDOW_STATE };
}

// Debounce-обёртка для сохранения состояния
let saveStateTimer: ReturnType<typeof setTimeout> | null = null;

function saveWindowStateDebounced(): void {
  if (saveStateTimer) clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => {
    saveWindowState();
  }, 500);
}

function saveWindowState(): void {
  if (!mainWindow) return;
  try {
    // Не сохраняем позицию если окно максимизировано или свернуто
    if (mainWindow.isMaximized() || mainWindow.isMinimized()) {
      const state: WindowState = {
        width: mainWindow.getNormalBounds().width,
        height: mainWindow.getNormalBounds().height,
        isMaximized: mainWindow.isMaximized(),
      };
      fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state, null, 2));
      return;
    }

    const bounds = mainWindow.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: false,
    };
    fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[JARVIS] Не удалось сохранить состояние окна:', (err as Error).message);
  }
}

// ─── Tray Icon (inline SVG → data URL) ──────────────────────────────────────

const TRAY_ICON_DATA_URL = nativeImage.createFromDataURL(
  'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="10" fill="none" stroke="#00e5ff" stroke-width="1.5" opacity="0.8"/>
    <text x="11" y="15.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="13" fill="#00e5ff">J</text>
  </svg>`).toString('base64')
);

// ─── Tray Menu Builder ──────────────────────────────────────────────────────

function buildTrayMenu(): Menu {
  const statusLabel = isOnline ? '🟢 JARVIS Online' : '🔴 JARVIS Offline';
  const isFullScreen = mainWindow?.isFullScreen() ?? false;
  const isMaximized = mainWindow?.isMaximized() ?? false;

  const opacitySubItems = [1.0, 0.8, 0.6, 0.4, 0.2].map((val) => ({
    label: `${Math.round(val * 100)}%`,
    type: 'checkbox' as const,
    checked: Math.abs(currentOpacity - val) < 0.05,
    click: () => {
      currentOpacity = val;
      mainWindow?.setOpacity(val);
      tray?.setContextMenu(buildTrayMenu());
    },
  }));

  return Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Показать окно',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: isFullScreen ? 'Оконный режим' : 'На весь экран',
      click: () => {
        mainWindow?.setFullScreen(!isFullScreen);
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    {
      label: 'Поверх всех окон',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        mainWindow?.setAlwaysOnTop(isAlwaysOnTop);
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Прозрачность',
      submenu: Menu.buildFromTemplate(opacitySubItems),
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ] as any);
}

function createTray(): void {
  tray = new Tray(TRAY_ICON_DATA_URL);
  tray.setToolTip('J.A.R.V.I.S. AI Assistant');
  tray.setContextMenu(buildTrayMenu());

  // Left-click: toggle window visibility
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function refreshTray(): void {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}

// ─── Status Polling ────────────────────────────────────────────────────────

function checkOnlineStatus(): void {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  fetch(`${NEXT_URL}/api/jarvis/system`, { signal: controller.signal })
    .then(() => {
      const wasOffline = !isOnline;
      isOnline = true;
      if (wasOffline) refreshTray();
    })
    .catch(() => {
      const wasOnline = isOnline;
      isOnline = false;
      if (wasOnline) refreshTray();
    })
    .finally(() => clearTimeout(timeout));
}

// ─── Protocol Handler (jarvis://) ─────────────────────────────────────────
// Обработка кастомного протокола jarvis:// для глубоких ссылок

function registerProtocolHandler(): void {
  // Регистрируем jarvis:// как протокол по умолчанию
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient('jarvis');
  }
}

function handleProtocolUrl(url: string): void {
  if (!url.startsWith('jarvis://')) return;

  try {
    const parsedUrl = new URL(url);
    console.log(`[JARVIS] Получен jarvis:// URL: ${url}`);

    // Если окно уже создано — отправляем URL в рендерер
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('protocol-url', {
        href: parsedUrl.href,
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        hash: parsedUrl.hash,
        searchParams: Object.fromEntries(parsedUrl.searchParams),
      });
    }
  } catch (err) {
    console.error('[JARVIS] Ошибка разбора jarvis:// URL:', (err as Error).message);
  }
}

// ─── Window Creation ────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const savedState = loadWindowState();

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedState.width,
    height: savedState.height,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    transparent: true,
    hasShadow: true,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // Восстанавливаем позицию окна, если она была сохранена
  if (savedState.x !== undefined && savedState.y !== undefined) {
    windowOptions.x = savedState.x;
    windowOptions.y = savedState.y;
  }

  const win = new BrowserWindow(windowOptions);

  // Центрируем только если нет сохранённой позиции
  if (savedState.x === undefined || savedState.y === undefined) {
    win.center();
  }

  // Восстанавливаем состояние «максимизировано» после показа
  if (savedState.isMaximized) {
    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
      // Windows balloon notification
      if (process.platform === 'win32') {
        tray?.displayBalloon({ title: 'J.A.R.V.I.S.', content: 'Online. Все системы в норме, сэр.' });
      }
    });
  } else {
    // Show window when ready to prevent visual flash
    win.once('ready-to-show', () => {
      win.show();
      // Windows balloon notification
      if (process.platform === 'win32') {
        tray?.displayBalloon({ title: 'J.A.R.V.I.S.', content: 'Online. Все системы в норме, сэр.' });
      }
    });
  }

  // Forward state changes to renderer
  win.on('maximize', () => {
    win.webContents.send('maximize-change', true);
    saveWindowStateDebounced();
  });
  win.on('unmaximize', () => {
    win.webContents.send('maximize-change', false);
    saveWindowStateDebounced();
  });
  win.on('enter-full-screen', () => win.webContents.send('fullscreen-change', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-change', false));

  // Сохранение позиции и размера при перемещении/ресайзе (с дебаунсом)
  win.on('move', () => saveWindowStateDebounced());
  win.on('resize', () => saveWindowStateDebounced());

  // Обработка jarvis:// URL из рендерера (если он запросит навигацию)
  ipcMain.on('window:jarvis-url', (_event, url: string) => {
    handleProtocolUrl(url);
  });

  // Hide to tray instead of closing
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    } else {
      // Сохраняем состояние при финальном закрытии
      saveWindowState();
    }
  });

  mainWindow = win;
  return win;
}

// ─── Next.js Server ────────────────────────────────────────────────────────

function spawnNextServer(): void {
  if (isDev) {
    console.log('[JARVIS] Dev mode — expecting Next.js dev server on port 3000');
    return;
  }

  console.log('[JARVIS] Spawning Next.js production server...');
  nextProcess = spawn('npx', ['next', 'start', '-p', String(NEXT_PORT)], {
    cwd: app.getAppPath(),
    stdio: 'pipe',
    shell: true,
  });

  nextProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  nextProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Next.js] ${data.toString().trim()}`);
  });

  nextProcess.on('close', (code) => {
    console.log(`[Next.js] Exited with code ${code}`);
    nextProcess = null;
  });

  nextProcess.on('error', (err) => {
    console.error(`[Next.js] Failed to start: ${err.message}`);
  });
}

function loadApp(win: BrowserWindow): void {
  if (isDev) {
    win.loadURL(NEXT_URL);
  } else {
    const tryLoad = (attempts = 0): void => {
      if (attempts > 30) {
        console.error('[JARVIS] Failed to connect after 30 attempts');
        return;
      }
      const req = http.get(NEXT_URL, () => win.loadURL(NEXT_URL));
      req.on('error', () => setTimeout(() => tryLoad(attempts + 1), 1000));
      req.setTimeout(1000, () => { req.destroy(); setTimeout(() => tryLoad(attempts + 1), 1000); });
    };
    tryLoad();
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.handle('window:minimize', () => mainWindow?.minimize());

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

ipcMain.handle('window:close', () => mainWindow?.close());

ipcMain.handle('window:always-on-top', (_event, flag: boolean) => {
  isAlwaysOnTop = flag;
  mainWindow?.setAlwaysOnTop(flag);
  refreshTray();
});

ipcMain.handle('window:opacity', (_event, value: number) => {
  currentOpacity = value;
  mainWindow?.setOpacity(value);
  refreshTray();
});

ipcMain.handle('window:fullscreen', () => {
  mainWindow?.setFullScreen(!mainWindow?.isFullScreen());
  refreshTray();
});

ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

// ─── Новые IPC-обработчики ─────────────────────────────────────────────────

// Информация о платформе (win32, darwin, linux)
ipcMain.handle('app:get-platform', () => process.platform);

// Информация об экране (рабочая область)
ipcMain.handle('app:get-screen-info', () => {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workAreaSize;
  return {
    width: workArea.width,
    height: workArea.height,
    scaleFactor: display.scaleFactor,
    isPrimary: true,
  };
});

// Автозапуск при входе в систему
ipcMain.handle('app:set-autostart', (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
});

ipcMain.handle('app:get-autostart', () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
});

// ─── App Lifecycle ──────────────────────────────────────────────────────────

// Регистрация протокола jarvis://
registerProtocolHandler();

// Если приложение уже запущено и открыт jarvis:// — фокусируем окно и передаём URL
app.on('second-instance', (_event, commandLine) => {
  // commandLine — массив, ищем jarvis:// URL
  const jarvisUrl = commandLine.find((arg) => arg.startsWith('jarvis://'));
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (jarvisUrl) {
      handleProtocolUrl(jarvisUrl);
    }
  }
});

// macOS: обработка jarvis:// URL когда приложение уже запущено
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('jarvis://')) {
    handleProtocolUrl(url);
  }
});

// Если получили аргумент jarvis:// при холодном старте — сохраним для рендерера
const cliJarvisUrl = process.argv.find((arg) => arg.startsWith('jarvis://'));

app.whenReady().then(() => {
  if (!isDev) spawnNextServer();

  const win = createWindow();
  createTray();

  setTimeout(() => loadApp(win), isDev ? 100 : 1000);

  // Если при старте передан jarvis:// URL — отправляем в рендерер после загрузки
  if (cliJarvisUrl) {
    win.webContents.once('did-finish-load', () => {
      handleProtocolUrl(cliJarvisUrl);
    });
  }

  // Global shortcut: Ctrl+Shift+J to toggle window
  globalShortcut.register('Ctrl+Shift+J', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Poll JARVIS status every 15s for tray menu
  setInterval(checkOnlineStatus, 15000);
  checkOnlineStatus();
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;

  if (nextProcess) {
    console.log('[JARVIS] Killing Next.js process...');
    nextProcess.kill('SIGTERM');
    nextProcess = null;
  }

  // Финальное сохранение состояния окна
  saveWindowState();
});