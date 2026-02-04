'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

export function ResizeHandle({ side, onResize, onResizeEnd }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let lastX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastX === 0) {
        lastX = e.clientX;
        return;
      }

      const delta = e.clientX - lastX;
      lastX = e.clientX;

      const adjustedDelta = side === 'left' ? delta : -delta;
      onResize(adjustedDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, side, onResize, onResizeEnd]);

  return (
    <hr
      aria-orientation="vertical"
      aria-valuenow={50}
      className={cn(
        'w-1 h-full border-0 cursor-col-resize transition-colors shrink-0 m-0',
        'hover:bg-primary/20 active:bg-primary/30',
        isDragging && 'bg-primary/30'
      )}
      onMouseDown={handleMouseDown}
    />
  );
}
