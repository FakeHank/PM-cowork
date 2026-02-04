'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  FolderKanban,
  FileText,
  ArrowUp,
  Home,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useWorkspaceStore } from '@/stores/app-store';
import type { FolderDetectResult } from '@/app/api/folder/detect/route';
import type { BrowseResult, DirectoryItem } from '@/app/api/folder/browse/route';

type DialogState = 
  | { type: 'closed' }
  | { type: 'browsing'; currentPath: string; parentPath: string | null; items: DirectoryItem[]; loading: boolean }
  | { type: 'confirming-project'; result: FolderDetectResult }
  | { type: 'confirming-unknown'; result: FolderDetectResult }
  | { type: 'error'; message: string };

interface FolderSelectorProps {
  projectName?: string;
  versionName?: string;
  currentPath?: string;
}

export function FolderSelector({ projectName, versionName, currentPath }: FolderSelectorProps) {
  const router = useRouter();
  const { setCurrentFolderPath, recentFolders, addRecentFolder } = useWorkspaceStore();
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'closed' });

  const displayName = projectName && versionName 
    ? `${projectName} / ${versionName}`
    : 'Select Folder';

  const loadDirectory = async (dirPath?: string) => {
    setDialogState(prev => ({
      type: 'browsing',
      currentPath: prev.type === 'browsing' ? prev.currentPath : '',
      parentPath: prev.type === 'browsing' ? prev.parentPath : null,
      items: prev.type === 'browsing' ? prev.items : [],
      loading: true,
    }));

    try {
      const url = dirPath ? `/api/folder/browse?path=${encodeURIComponent(dirPath)}` : '/api/folder/browse';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setDialogState({ type: 'error', message: data.error || 'Failed to load directory' });
        return;
      }

      const result: BrowseResult = data.data;
      setDialogState({
        type: 'browsing',
        currentPath: result.currentPath,
        parentPath: result.parentPath,
        items: result.items,
        loading: false,
      });
    } catch {
      setDialogState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleOpenDialog = () => {
    loadDirectory(currentPath || undefined);
  };

  const handleCloseDialog = () => {
    setDialogState({ type: 'closed' });
  };

  const handleNavigateToDirectory = (item: DirectoryItem) => {
    if (item.type === 'version') {
      handleSelectVersionFolder(item.path);
    } else if (item.type === 'project') {
      handleSelectProjectFolder(item.path);
    } else {
      loadDirectory(item.path);
    }
  };

  const handleNavigateUp = () => {
    if (dialogState.type === 'browsing' && dialogState.parentPath) {
      loadDirectory(dialogState.parentPath);
    }
  };

  const handleNavigateHome = () => {
    loadDirectory(undefined);
  };

  const handleSelectCurrentFolder = async () => {
    if (dialogState.type !== 'browsing') return;
    
    try {
      const response = await fetch('/api/folder/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: dialogState.currentPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDialogState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;

      if (result.type === 'version') {
        navigateToVersion(result);
      } else if (result.type === 'project') {
        setDialogState({ type: 'confirming-project', result });
      } else {
        setDialogState({ type: 'confirming-unknown', result });
      }
    } catch {
      setDialogState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleSelectVersionFolder = async (folderPath: string) => {
    try {
      const response = await fetch('/api/folder/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDialogState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;
      if (result.type === 'version') {
        navigateToVersion(result);
      }
    } catch {
      setDialogState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleSelectProjectFolder = async (folderPath: string) => {
    try {
      const response = await fetch('/api/folder/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDialogState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;
      if (result.type === 'project') {
        setDialogState({ type: 'confirming-project', result });
      }
    } catch {
      setDialogState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const navigateToVersion = (result: FolderDetectResult) => {
    if (!result.versionPath || !result.projectPath) return;

    const projectId = result.projectPath.split('/').pop();
    const versionId = result.versionPath.split('/').pop();

    if (projectId && versionId) {
      setCurrentFolderPath(result.versionPath);
      addRecentFolder({
        path: result.versionPath,
        projectName: result.projectName || projectId,
        versionName: result.versionName || versionId,
      });
      handleCloseDialog();
      router.push(`/workspace/${projectId}/${versionId}`);
    }
  };

  const handleOpenLatestVersion = (result: FolderDetectResult) => {
    if (!result.latestVersion || !result.projectPath) return;

    const projectId = result.projectPath.split('/').pop();
    const versionId = result.latestVersion.path.split('/').pop();

    if (projectId && versionId) {
      setCurrentFolderPath(result.latestVersion.path);
      addRecentFolder({
        path: result.latestVersion.path,
        projectName: result.projectName || projectId,
        versionName: result.latestVersion.name,
      });
      handleCloseDialog();
      router.push(`/workspace/${projectId}/${versionId}`);
    }
  };

  const handleInitializeProject = async (folderPath: string) => {
    setDialogState({
      type: 'browsing',
      currentPath: folderPath,
      parentPath: null,
      items: [],
      loading: true,
    });

    try {
      const response = await fetch('/api/folder/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDialogState({ type: 'error', message: data.error || 'Failed to initialize project' });
        return;
      }

      const { projectPath, projectName: pName, versionPath, versionName: vName } = data.data;
      const projectId = projectPath.split('/').pop();
      const versionId = versionPath.split('/').pop();

      if (projectId && versionId) {
        setCurrentFolderPath(versionPath);
        addRecentFolder({
          path: versionPath,
          projectName: pName,
          versionName: vName,
        });
        handleCloseDialog();
        router.push(`/workspace/${projectId}/${versionId}`);
      }
    } catch {
      setDialogState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleBackToBrowsing = () => {
    if (dialogState.type === 'confirming-project' || dialogState.type === 'confirming-unknown') {
      loadDirectory(dialogState.result.folderPath);
    } else {
      loadDirectory(undefined);
    }
  };

  const handleSelectRecent = (folder: { path: string }) => {
    handleSelectVersionFolder(folder.path);
  };

  const getItemIcon = (item: DirectoryItem) => {
    switch (item.type) {
      case 'version':
        return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'project':
        return <FolderKanban className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <Folder className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenDialog}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
      >
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-semibold truncate max-w-[200px]">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={dialogState.type !== 'closed'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          {dialogState.type === 'browsing' && (
            <>
              <DialogHeader>
                <DialogTitle>选择文件夹</DialogTitle>
                <DialogDescription className="truncate font-mono text-xs">
                  {dialogState.currentPath}
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex items-center gap-1 border-b pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateHome}
                  disabled={dialogState.loading}
                >
                  <Home className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNavigateUp}
                  disabled={dialogState.loading || !dialogState.parentPath}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-sm text-muted-foreground truncate px-2">
                  {dialogState.currentPath.split('/').slice(-2).join('/')}
                </div>
              </div>

              <div className="flex flex-1 gap-4 min-h-0">
                <ScrollArea className="flex-1 border rounded-md">
                  {dialogState.loading ? (
                    <div className="flex items-center justify-center h-[280px]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : dialogState.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                      <Folder className="h-8 w-8 mb-2" />
                      <p className="text-sm">空文件夹</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-0.5">
                      {dialogState.items.map((item) => (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => handleNavigateToDirectory(item)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left text-sm group"
                        >
                          {getItemIcon(item)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.name}</div>
                            {item.type === 'project' && item.projectName && (
                              <div className="text-xs text-amber-600 truncate">Project: {item.projectName}</div>
                            )}
                            {item.type === 'version' && item.versionName && (
                              <div className="text-xs text-blue-600 truncate">Version: {item.versionName}</div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {recentFolders.length > 0 && (
                  <div className="w-52 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Clock className="h-4 w-4" />
                      <span>最近打开</span>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-md">
                      <div className="p-2 space-y-0.5">
                        {recentFolders.slice(0, 8).map((folder) => (
                          <button
                            type="button"
                            key={folder.path}
                            onClick={() => handleSelectRecent(folder)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-left text-xs"
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {folder.projectName}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {folder.versionName}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  取消
                </Button>
                <Button onClick={handleSelectCurrentFolder} disabled={dialogState.loading}>
                  选择当前文件夹
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === 'confirming-project' && (
            <>
              <DialogHeader>
                <DialogTitle>检测到项目文件夹</DialogTitle>
                <DialogDescription>
                  这是一个项目文件夹「{dialogState.result.projectName}」，
                  {dialogState.result.latestVersion 
                    ? `是否打开最新版本「${dialogState.result.latestVersion.name}」？`
                    : '但没有找到任何版本。'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleBackToBrowsing}>
                  返回浏览
                </Button>
                {dialogState.result.latestVersion && (
                  <Button onClick={() => handleOpenLatestVersion(dialogState.result)}>
                    打开最新版本
                  </Button>
                )}
              </DialogFooter>
            </>
          )}

          {dialogState.type === 'confirming-unknown' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  普通文件夹
                </DialogTitle>
                <DialogDescription className="text-amber-600/80">
                  这个文件夹不是 PMWork 项目。是否要在此处创建新项目？
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm font-mono truncate text-amber-800">{dialogState.result.folderPath}</p>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleBackToBrowsing}>
                  返回浏览
                </Button>
                <Button onClick={() => handleInitializeProject(dialogState.result.folderPath)}>
                  创建新项目
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  出错了
                </DialogTitle>
                <DialogDescription>{dialogState.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleBackToBrowsing}>
                  返回
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
