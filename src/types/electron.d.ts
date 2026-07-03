/** Структура, описывающая разобранный jarvis:// URL */
interface ProtocolUrlData {
  href: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  searchParams: Record<string, string>;
}

/** Информация о рабочей области экрана */
interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

interface JarvisElectron {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  setAlwaysOnTop(_flag: boolean): Promise<void>;
  setOpacity(_value: number): Promise<void>;
  toggleFullscreen(): Promise<void>;
  getVersion(): Promise<string>;
  onWindowEvent(callback: (_event: string, _data?: unknown) => void): void;
  /** Информация о текущей платформе (win32, darwin, linux) */
  getPlatform(): Promise<string>;
  /** Информация о рабочей области основного экрана */
  getScreenInfo(): Promise<ScreenInfo>;
  /** Включить/выключить автозапуск при входе в систему */
  setAutostart(_enabled: boolean): Promise<void>;
  /** Текущее состояние автозапуска */
  getAutostart(): Promise<boolean>;
  /** Подписка на получение jarvis:// URL из основного процесса */
  onProtocolUrl(callback: (_data: ProtocolUrlData) => void): () => void;
}

declare global {
  interface Window {
    jarvisElectron?: JarvisElectron;
  }
}

export {};