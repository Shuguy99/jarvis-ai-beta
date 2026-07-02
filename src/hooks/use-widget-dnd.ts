"use client";

import { useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DndItem {
  id: string;
}

export interface UseWidgetDndOptions {
  items: DndItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export interface UseWidgetDndReturn {
  dragItem: DndItem | null;
  dragOverIndex: number | null;
  dragOverPosition: "before" | "after" | null;
  handleDragStart: (e: React.DragEvent, item: DndItem, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
}

// ─── DataTransfer key to store column identifier ────────────────────────────

const COLUMN_KEY = "text/jarvis-column-id";
const INDEX_KEY = "text/jarvis-source-index";

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWidgetDnd({
  items,
  onReorder,
}: UseWidgetDndOptions): UseWidgetDndReturn {
  const [dragItem, setDragItem] = useState<DndItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    "before" | "after" | null
  >(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: DndItem, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      // Store the source index
      e.dataTransfer.setData(INDEX_KEY, String(index));
      // Store a column identifier — by default use the item id's first segment,
      // but consumers can set COLUMN_KEY on the element's dataset to override
      const columnId =
        (e.currentTarget as HTMLElement).dataset.columnId ?? "default";
      e.dataTransfer.setData(COLUMN_KEY, columnId);
      setDragItem(item);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Only allow drops within the same column
      const sourceColumn = e.dataTransfer.types.includes(COLUMN_KEY)
        ? "same-column-check"
        : null;
      if (sourceColumn === null) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? "before" : "after";

      setDragOverIndex(index);
      setDragOverPosition(position);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverIndex(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();

      // Parse source index from dataTransfer
      const rawIndex = e.dataTransfer.getData(INDEX_KEY);
      const fromIndex = parseInt(rawIndex, 10);
      if (isNaN(fromIndex) || fromIndex < 0 || fromIndex >= items.length) {
        handleDragEnd();
        return;
      }

      // Calculate insertion point based on position
      let toIndex: number;
      if (dragOverPosition === "after") {
        toIndex = index + 1;
      } else {
        toIndex = index;
      }

      // Clamp to valid range
      toIndex = Math.max(0, Math.min(items.length, toIndex));

      // No-op if same position
      if (fromIndex === toIndex || fromIndex === toIndex - 1) {
        handleDragEnd();
        return;
      }

      onReorder(fromIndex, toIndex);
      handleDragEnd();
    },
    [items.length, onReorder, dragOverPosition, handleDragEnd]
  );

  return {
    dragItem,
    dragOverIndex,
    dragOverPosition,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  };
}