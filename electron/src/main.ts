import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
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

// ─── Window Creation ────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
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
  });

  win.center();

  // Show window when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win.show();
    // Windows balloon notification
    if (process.platform === 'win32') {
      tray?.displayBalloon({ title: 'J.A.R.V.I.S.', content: 'Online. Все системы в норме, сэр.' });
    }
  });

  // Forward state changes to renderer
  win.on('maximize', () => win.webContents.send('maximize-change', true));
  win.on('unmaximize', () => win.webContents.send('maximize-change', false));
  win.on('enter-full-screen', () => win.webContents.send('fullscreen-change', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen-change', false));

  // Hide to tray instead of closing
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
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

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (!isDev) spawnNextServer();

  const win = createWindow();
  createTray();

  setTimeout(() => loadApp(win), isDev ? 100 : 1000);

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
});