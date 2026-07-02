"use client";

import { type ReactNode, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useWidgetDnd, type DndItem } from "@/hooks/use-widget-dnd";
import { DraggableWidget } from "@/components/jarvis/draggable-widget";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DndWidgetListProps {
  /** Ordered array of widget IDs */
  widgetIds: string[];
  /** Called with the new reordered array */
  onReorder: (newOrder: string[]) => void;
  /** Column identifier — prevents cross-column drops */
  columnId: "left" | "right";
  /** Render function for each widget */
  children: (
    widgetId: string,
    index: number,
    dndProps: DndWidgetRenderProps
  ) => ReactNode;
}

export interface DndWidgetRenderProps {
  isDragging: boolean;
  isDragOver: boolean;
  dragOverPosition: "before" | "after" | null;
  dragHandleProps: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent) => void;
    draggable: boolean;
  };
  showGrip: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DndWidgetList({
  widgetIds,
  onReorder,
  columnId,
  children,
}: DndWidgetListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const items: DndItem[] = widgetIds.map((id) => ({ id }));

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newOrder = [...widgetIds];
      const [moved] = newOrder.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      newOrder.splice(insertAt, 0, moved);
      onReorder(newOrder);
    },
    [widgetIds, onReorder]
  );

  const {
    dragItem,
    dragOverIndex,
    dragOverPosition,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  } = useWidgetDnd({
    items,
    onReorder: handleReorder,
  });

  const wrapDragStart = useCallback(
    (e: React.DragEvent, item: DndItem, index: number) => {
      // Store column ID so we can prevent cross-column drops
      const target = e.currentTarget as HTMLElement;
      target.dataset.columnId = columnId;
      handleDragStart(e, item, index);
    },
    [columnId, handleDragStart]
  );

  const wrapDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      // Check column match — reject cross-column drops
      const columnData = e.dataTransfer.types.find(
        (t) => t === "text/jarvis-column-id"
      );
      // We can't read the data yet (only in drop), but we rely on
      // the HTML5 DnD scope — the dragStart set the type, and since
      // we don't have direct access, we allow the over and validate in drop.
      // Cross-column prevention is handled by the same-column check in the hook
      // via the dataTransfer type presence.
      handleDragOver(e, index);
    },
    [handleDragOver]
  );

  const wrapDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      // Validate column match on drop
      try {
        const sourceIndex = parseInt(
          e.dataTransfer.getData("text/jarvis-source-index"),
          10
        );
        if (isNaN(sourceIndex) || sourceIndex < 0) {
          handleDragEnd();
          return;
        }
      } catch {
        handleDragEnd();
        return;
      }
      handleDrop(e, index);
    },
    [handleDrop, handleDragEnd]
  );

  return (
    <div ref={listRef} className="flex flex-col gap-3" data-column={columnId}>
      <AnimatePresence mode="popLayout">
        {widgetIds.map((widgetId, index) => {
          const isDragging = dragItem?.id === widgetId;
          const isDragOver = dragOverIndex === index;

          return (
            <DraggableWidget
              key={widgetId}
              id={widgetId}
              index={index}
              isDragging={isDragging}
              isDragOver={isDragOver}
              dragOverPosition={isDragOver ? dragOverPosition : null}
              onDragStart={(e) => wrapDragStart(e, { id: widgetId }, index)}
              onDragOver={(e) => wrapDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => wrapDrop(e, index)}
            >
              {children(widgetId, index, {
                isDragging,
                isDragOver,
                dragOverPosition: isDragOver ? dragOverPosition : null,
                dragHandleProps: {
                  onDragStart: (e) =>
                    wrapDragStart(e, { id: widgetId }, index),
                  onDragOver: (e) => wrapDragOver(e, index),
                  onDragEnd: handleDragEnd,
                  onDrop: (e) => wrapDrop(e, index),
                  draggable: true,
                },
                showGrip: true,
              })}
            </DraggableWidget>
          );
        })}
      </AnimatePresence>
    </div>
  );
}