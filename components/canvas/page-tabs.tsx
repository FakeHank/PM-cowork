'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCanvasStore } from '@/stores/canvas-store';

interface PageTabsProps {
  canvasId: string;
}

export function PageTabs({ canvasId }: PageTabsProps) {
  const { pages, currentPageId, setCurrentPage, addPage } = useCanvasStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAddPage = async () => {
    if (!newPageName.trim()) return;

    try {
      setIsCreating(true);
      
      const response = await fetch(`/api/canvas/${canvasId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPageName }),
      });

      if (!response.ok) {
        throw new Error('Failed to create page');
      }

      const newPage = await response.json();
      addPage(newPage);
      setCurrentPage(newPage.id);
      setNewPageName('');
      setIsAdding(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create page');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50 overflow-x-auto">
      {pages.map((page) => (
        <Button
          key={page.id}
          variant={currentPageId === page.id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setCurrentPage(page.id)}
          className="min-w-[100px] justify-between"
        >
          <span className="truncate">{page.name}</span>
        </Button>
      ))}

      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            placeholder="Page name"
            className="h-8 w-32"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddPage();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewPageName('');
              }
            }}
            disabled={isCreating}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsAdding(false);
              setNewPageName('');
            }}
            disabled={isCreating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="text-muted-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Page
        </Button>
      )}
    </div>
  );
}
