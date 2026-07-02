"use client";

import { useCallback, useRef } from "react";
import { playSound, initAudio, type SoundName } from "@/lib/sounds";

/** Инициализировать аудио-контекст при первом взаимодействии */
export function useAudioInit() {
  const inited = useRef(false);
  return useCallback(() => {
    if (!inited.current) {
      initAudio();
      inited.current = true;
    }
  }, []);
}

/** Воспроизвести звук по имени */
export function usePlaySound() {
  return useCallback((name: SoundName) => {
    playSound(name);
  }, []);
}

/** Хук для звуковых эффектов на кнопках */
export function useButtonSound() {
  return useCallback(() => {
    playSound("click");
  }, []);
}