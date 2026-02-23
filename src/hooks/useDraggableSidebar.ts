import { useState, useCallback, useRef, useEffect } from "react";

export type SidebarPosition = "right" | "left" | "top" | "bottom";

interface UseDraggableSidebarReturn {
  position: SidebarPosition;
  isExpanded: boolean;
  isDragging: boolean;
  toggleExpanded: () => void;
  setExpanded: (val: boolean) => void;
  handleDragStart: (e: React.TouchEvent | React.MouseEvent) => void;
}

const STORAGE_KEY = "match-sidebar-position";

export function useDraggableSidebar(): UseDraggableSidebarReturn {
  const [position, setPosition] = useState<SidebarPosition>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as SidebarPosition) || "right";
    } catch { return "right"; }
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, position); } catch {}
  }, [position]);

  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const touch = "touches" in e ? e.touches[0] : e;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);

    const handleMove = (ev: TouchEvent | MouseEvent) => {
      const point = "touches" in ev ? (ev as TouchEvent).touches[0] : (ev as MouseEvent);
      const dx = point.clientX - startPos.current.x;
      const dy = point.clientY - startPos.current.y;

      if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
        if (Math.abs(dx) > Math.abs(dy)) {
          setPosition(dx > 0 ? "right" : "left");
        } else {
          setPosition(dy > 0 ? "bottom" : "top");
        }
        cleanup();
      }
    };

    const cleanup = () => {
      setIsDragging(false);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("touchend", cleanup);
      document.removeEventListener("mouseup", cleanup);
    };

    document.addEventListener("touchmove", handleMove);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("touchend", cleanup);
    document.addEventListener("mouseup", cleanup);
  }, []);

  return {
    position,
    isExpanded,
    isDragging,
    toggleExpanded,
    setExpanded: setIsExpanded,
    handleDragStart,
  };
}
