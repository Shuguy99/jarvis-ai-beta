import { useEffect, useCallback, useRef } from "react";

interface UsePushToTalkOptions {
  onHold: () => void;   // called when space is pressed down
  onRelease: () => void; // called when space is released
}

/**
 * Push-to-talk: hold Space (when no input is focused) to activate voice.
 * Works globally in the JARVIS window.
 */
export function usePushToTalk({ onHold, onRelease }: UsePushToTalkOptions) {
  const isActive = useRef(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== "Space" || isActive.current) return;

    // Don't trigger if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    e.preventDefault();
    isActive.current = true;
    onHold();
  }, [onHold]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code !== "Space" || !isActive.current) return;
    e.preventDefault();
    isActive.current = false;
    onRelease();
  }, [onRelease]);

  // Also handle window blur (user switches away while holding space)
  const handleBlur = useCallback(() => {
    if (isActive.current) {
      isActive.current = false;
      onRelease();
    }
  }, [onRelease]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
}