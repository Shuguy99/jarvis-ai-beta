interface JarvisElectron {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  setAlwaysOnTop(flag: boolean): Promise<void>;
  setOpacity(value: number): Promise<void>;
  toggleFullscreen(): Promise<void>;
  getVersion(): Promise<string>;
  onWindowEvent(callback: (event: string, data?: unknown) => void): void;
}

declare global {
  interface Window {
    jarvisElectron?: JarvisElectron;
  }
}

export {};