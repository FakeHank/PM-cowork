'use client';

import { useState } from 'react';
import {
  FolderTree,
  PanelRightClose,
  PanelRight,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app-store';
import { FileBrowser } from '@/components/files/file-browser';
import { FilePreview } from '@/components/files/file-preview';
import { ResizeHandle } from './resize-handle';

interface RightPanelProps {
  side?: 'left' | 'right';
}

export function RightPanel({ side = 'right' }: RightPanelProps) {
  const { 
    rightPanelOpen, 
    toggleRightPanel, 
    currentVersion,
    rightPanelWidth,
    setRightPanelWidth,
    setActiveSession
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

  const handleContinueSession = (sessionId: string) => {
    if (currentVersion) {
      setActiveSession({ versionId: currentVersion.id, sessionId });
    }
    setSelectedFile(null);
  };

  const isLeft = side === 'left';
  const OpenIcon = isLeft ? PanelLeft : PanelRight;
  const CloseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const borderClass = isLeft ? 'border-r' : 'border-l';

  if (!rightPanelOpen) {
    return (
      <div className={`flex flex-col items-center py-4 ${borderClass} bg-muted/30 w-12`}>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleRightPanel}
          className="h-8 w-8"
        >
          <OpenIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const panel = (
    <aside 
      className={`flex flex-col ${borderClass} bg-muted/30`}
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
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-0">
        {currentVersion ? (
          selectedFile ? (
            <FilePreview
              versionId={currentVersion.id}
              filePath={selectedFile}
              onBack={handleBack}
              onContinueSession={handleContinueSession}
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
  );

  return (
    <div className="flex">
      {isLeft ? (
        <>
          {panel}
          <ResizeHandle side="left" onResize={handleResize} />
        </>
      ) : (
        <>
          <ResizeHandle side="right" onResize={handleResize} />
          {panel}
        </>
      )}
    </div>
  );
}
