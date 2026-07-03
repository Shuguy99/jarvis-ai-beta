import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Структура, описывающая разобранный jarvis:// URL
export interface ProtocolUrlData {
  href: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  searchParams: Record<string, string>;
}

// Структура с информацией об экране
export interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface JarvisElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setOpacity: (value: number) => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  getVersion: () => Promise<string>;
  onWindowEvent: (callback: (event: string, value: boolean) => void) => () => void;
  /** Информация о текущей платформе (win32, darwin, linux) */
  getPlatform: () => Promise<string>;
  /** Информация о рабочей области основного экрана */
  getScreenInfo: () => Promise<ScreenInfo>;
  /** Включить/выключить автозапуск при входе в систему */
  setAutostart: (enabled: boolean) => Promise<void>;
  /** Текущее состояние автозапуска */
  getAutostart: () => Promise<boolean>;
  /** Подписка на получение jarvis:// URL из основного процесса */
  onProtocolUrl: (callback: (data: ProtocolUrlData) => void) => () => void;
}

const api: JarvisElectronAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:always-on-top', flag),
  setOpacity: (value: number) => ipcRenderer.invoke('window:opacity', value),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  onWindowEvent: (callback: (event: string, value: boolean) => void) => {
    const onMaximizeChange = (_e: IpcRendererEvent, value: boolean) => {
      callback('maximize-change', value);
    };
    const onFullscreenChange = (_e: IpcRendererEvent, value: boolean) => {
      callback('fullscreen-change', value);
    };

    ipcRenderer.on('maximize-change', onMaximizeChange);
    ipcRenderer.on('fullscreen-change', onFullscreenChange);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('maximize-change', onMaximizeChange);
      ipcRenderer.removeListener('fullscreen-change', onFullscreenChange);
    };
  },

  // ─── Новые методы ─────────────────────────────────────────────────────

  getPlatform: () => ipcRenderer.invoke('app:get-platform'),

  getScreenInfo: () => ipcRenderer.invoke('app:get-screen-info'),

  setAutostart: (enabled: boolean) => ipcRenderer.invoke('app:set-autostart', enabled),

  getAutostart: () => ipcRenderer.invoke('app:get-autostart'),

  onProtocolUrl: (callback: (data: ProtocolUrlData) => void) => {
    const handler = (_e: IpcRendererEvent, data: ProtocolUrlData) => {
      callback(data);
    };
    ipcRenderer.on('protocol-url', handler);

    // Возвращаем функцию очистки
    return () => {
      ipcRenderer.removeListener('protocol-url', handler);
    };
  },
};

contextBridge.exposeInMainWorld('jarvisElectron', api);