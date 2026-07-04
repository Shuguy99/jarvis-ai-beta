

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Full-screen red flash overlay.
 * Mounts briefly on each new error (controlled via `key` prop from parent).
 * Auto-hides after 300ms.
 */
export function ErrorFlash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none"
          initial={{ backgroundColor: "oklch(0.65 0.22 22 / 8%)" }}
          animate={{ backgroundColor: "oklch(0.65 0.22 22 / 5%)" }}
          exit={{ backgroundColor: "transparent" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}