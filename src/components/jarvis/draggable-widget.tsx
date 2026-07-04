

import { type ReactNode, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DraggableWidgetProps {
  id: string;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  dragOverPosition: "before" | "after" | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DraggableWidget({
  id,
  index,
  isDragging,
  isDragOver,
  dragOverPosition,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  children,
}: DraggableWidgetProps) {
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={containerRef}
      layout
      layoutId={`dnd-widget-${id}`}
      className="relative"
      style={{
        opacity: isDragging ? 0.4 : 1,
        scale: isDragging ? 0.98 : 1,
      }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragEnd}
      onDrop={onDrop}
    >
      {/* ── Top drop indicator ── */}
      {isDragOver && dragOverPosition === "before" && (
        <motion.div
          layoutId={`indicator-${id}-before`}
          className="absolute -top-1 left-2 right-2 z-10 h-0.5 rounded-full bg-primary"
          style={{
            boxShadow:
              "0 0 8px oklch(0.85 0.19 193 / 60%), 0 0 16px oklch(0.85 0.19 193 / 30%)",
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          exit={{ scaleY: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
      )}

      {/* ── Widget content ── */}
      <div className="group relative">
        {/* ── Grip handle (only draggable part) ── */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={`absolute top-1.5 right-1.5 z-20 cursor-grab rounded-md p-1 text-muted-foreground/60 transition-all duration-200 hover:text-primary active:cursor-grabbing ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* ── Children ── */}
        {children}
      </div>

      {/* ── Bottom drop indicator ── */}
      {isDragOver && dragOverPosition === "after" && (
        <motion.div
          layoutId={`indicator-${id}-after`}
          className="absolute -bottom-1 left-2 right-2 z-10 h-0.5 rounded-full bg-primary"
          style={{
            boxShadow:
              "0 0 8px oklch(0.85 0.19 193 / 60%), 0 0 16px oklch(0.85 0.19 193 / 30%)",
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          exit={{ scaleY: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
      )}
    </motion.div>
  );
}