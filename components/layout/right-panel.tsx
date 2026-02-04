'use client';

import { useState } from 'react';
import { 
  FolderTree, 
  PanelRightClose,
  PanelRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app-store';
import { FileBrowser } from '@/components/files/file-browser';
import { FilePreview } from '@/components/files/file-preview';
import { ResizeHandle } from './resize-handle';

export function RightPanel() {
  const { 
    rightPanelOpen, 
    toggleRightPanel, 
    currentVersion,
    rightPanelWidth,
    setRightPanelWidth 
  } = useAppStore();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleResize = (delta: number) => {
    setRightPanelWidth(rightPanelWidth + delta);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const handleBack = () => {
    setSelectedFile(null);
  };

  if (!rightPanelOpen) {
    return (
      <div className="flex flex-col items-center py-4 border-l bg-muted/30 w-12">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleRightPanel}
          className="h-8 w-8"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex">
      <ResizeHandle side="right" onResize={handleResize} />
      <aside 
        className="flex flex-col border-l bg-muted/30"
        style={{ width: rightPanelWidth }}
      >
        {!selectedFile && (
          <div className="flex h-14 items-center justify-between px-4 border-b">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Files</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleRightPanel}
              className="h-8 w-8"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {currentVersion ? (
            selectedFile ? (
              <FilePreview
                versionId={currentVersion.id}
                filePath={selectedFile}
                onBack={handleBack}
              />
            ) : (
              <FileBrowser
                versionId={currentVersion.id}
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile || undefined}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              选择一个版本查看文件
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
