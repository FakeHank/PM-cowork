'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FolderOpen, 
  Folder, 
  Loader2, 
  ChevronRight,
  FolderKanban,
  FileText,
  ArrowUp,
  Home,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceStore } from '@/stores/app-store';
import type { FolderDetectResult } from '@/app/api/folder/detect/route';
import type { BrowseResult, DirectoryItem } from '@/app/api/folder/browse/route';

type PageState = 
  | { type: 'checking' }
  | { type: 'browsing'; currentPath: string; parentPath: string | null; items: DirectoryItem[]; loading: boolean }
  | { type: 'confirming-project'; result: FolderDetectResult; previousPath: string }
  | { type: 'confirming-unknown'; result: FolderDetectResult; previousPath: string }
  | { type: 'error'; message: string };

export default function WorkspacePage() {
  const router = useRouter();
  const { currentFolderPath, recentFolders, setCurrentFolderPath, addRecentFolder } = useWorkspaceStore();
  const [pageState, setPageState] = useState<PageState>({ type: 'checking' });
  const initialCheckDone = useRef(false);

  const navigateToVersion = useCallback((result: FolderDetectResult) => {
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
      router.push(`/workspace/${projectId}/${versionId}`);
    }
  }, [router, setCurrentFolderPath, addRecentFolder]);

  const navigateToLatestVersion = useCallback((result: FolderDetectResult) => {
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
      router.push(`/workspace/${projectId}/${versionId}`);
    }
  }, [router, setCurrentFolderPath, addRecentFolder]);

  const loadDirectory = useCallback(async (dirPath?: string) => {
    const currentState = pageState.type === 'browsing' ? pageState : null;
    
    setPageState({
      type: 'browsing',
      currentPath: currentState?.currentPath || '',
      parentPath: currentState?.parentPath || null,
      items: currentState?.items || [],
      loading: true,
    });

    try {
      const url = dirPath ? `/api/folder/browse?path=${encodeURIComponent(dirPath)}` : '/api/folder/browse';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setPageState({ type: 'error', message: data.error || 'Failed to load directory' });
        return;
      }

      const result: BrowseResult = data.data;
      setPageState({
        type: 'browsing',
        currentPath: result.currentPath,
        parentPath: result.parentPath,
        items: result.items,
        loading: false,
      });
    } catch {
      setPageState({ type: 'error', message: 'Network error occurred' });
    }
  }, [pageState]);

  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    if (!currentFolderPath) {
      loadDirectory(undefined);
      return;
    }

    const checkFolder = async () => {
      try {
        const response = await fetch('/api/folder/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: currentFolderPath }),
        });

        const data = await response.json();

        if (!response.ok) {
          setCurrentFolderPath(null);
          loadDirectory(undefined);
          return;
        }

        const result: FolderDetectResult = data.data;

        if (result.type === 'version') {
          navigateToVersion(result);
        } else if (result.type === 'project' && result.latestVersion) {
          navigateToLatestVersion(result);
        } else {
          setCurrentFolderPath(null);
          loadDirectory(undefined);
        }
      } catch {
        setCurrentFolderPath(null);
        loadDirectory(undefined);
      }
    };

    checkFolder();
  }, [currentFolderPath, setCurrentFolderPath, navigateToVersion, navigateToLatestVersion, loadDirectory]);

  const handleNavigateToDirectory = async (item: DirectoryItem) => {
    if (item.type === 'version') {
      handleSelectVersionFolder(item.path);
    } else if (item.type === 'project') {
      handleSelectProjectFolder(item.path);
    } else {
      loadDirectory(item.path);
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
        setPageState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;
      if (result.type === 'version') {
        navigateToVersion(result);
      }
    } catch {
      setPageState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleSelectProjectFolder = async (folderPath: string) => {
    const previousPath = pageState.type === 'browsing' ? pageState.currentPath : '';
    
    try {
      const response = await fetch('/api/folder/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPageState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;
      if (result.type === 'project') {
        setPageState({ type: 'confirming-project', result, previousPath });
      }
    } catch {
      setPageState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleSelectCurrentFolder = async () => {
    if (pageState.type !== 'browsing') return;
    const previousPath = pageState.currentPath;
    
    try {
      const response = await fetch('/api/folder/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: pageState.currentPath }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPageState({ type: 'error', message: data.error || 'Failed to detect folder' });
        return;
      }

      const result: FolderDetectResult = data.data;

      if (result.type === 'version') {
        navigateToVersion(result);
      } else if (result.type === 'project') {
        setPageState({ type: 'confirming-project', result, previousPath });
      } else {
        setPageState({ type: 'confirming-unknown', result, previousPath });
      }
    } catch {
      setPageState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleInitializeProject = async (folderPath: string) => {
    setPageState({
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
        setPageState({ type: 'error', message: data.error || 'Failed to initialize project' });
        return;
      }

      const { projectPath, projectName, versionPath, versionName } = data.data;
      const projectId = projectPath.split('/').pop();
      const versionId = versionPath.split('/').pop();

      if (projectId && versionId) {
        setCurrentFolderPath(versionPath);
        addRecentFolder({
          path: versionPath,
          projectName,
          versionName,
        });
        router.push(`/workspace/${projectId}/${versionId}`);
      }
    } catch {
      setPageState({ type: 'error', message: 'Network error occurred' });
    }
  };

  const handleBackToBrowsing = () => {
    if (pageState.type === 'confirming-project' || pageState.type === 'confirming-unknown') {
      loadDirectory(pageState.previousPath);
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
        return <FileText className="h-5 w-5 text-blue-500 shrink-0" />;
      case 'project':
        return <FolderKanban className="h-5 w-5 text-amber-500 shrink-0" />;
      default:
        return <Folder className="h-5 w-5 text-muted-foreground shrink-0" />;
    }
  };

  if (pageState.type === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">正在加载...</p>
      </div>
    );
  }

  if (pageState.type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-medium mb-2">出错了</h2>
        <p className="text-muted-foreground mb-4">{pageState.message}</p>
        <Button onClick={handleBackToBrowsing}>返回</Button>
      </div>
    );
  }

  if (pageState.type === 'confirming-project') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <FolderKanban className="h-16 w-16 mx-auto text-amber-500" />
          <div>
            <h1 className="text-2xl font-semibold mb-2">检测到项目文件夹</h1>
            <p className="text-muted-foreground">
              这是一个项目文件夹「{pageState.result.projectName}」
            </p>
          </div>
          
          {pageState.result.latestVersion ? (
            <>
              <p className="text-muted-foreground">
                是否打开最新版本「{pageState.result.latestVersion.name}」？
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleBackToBrowsing}>
                  返回浏览
                </Button>
                <Button onClick={() => navigateToLatestVersion(pageState.result)}>
                  打开最新版本
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">但没有找到任何版本。</p>
              <Button variant="outline" onClick={handleBackToBrowsing}>
                返回浏览
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (pageState.type === 'confirming-unknown') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-amber-500" />
          <div>
            <h1 className="text-2xl font-semibold mb-2 text-amber-600">普通文件夹</h1>
            <p className="text-amber-600/80">
              这个文件夹不是 PMWork 项目。是否要在此处创建新项目？
            </p>
          </div>
          
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm font-mono truncate text-amber-800">{pageState.result.folderPath}</p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleBackToBrowsing}>
              返回浏览
            </Button>
            <Button onClick={() => handleInitializeProject(pageState.result.folderPath)}>
              创建新项目
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadDirectory(undefined)}
          disabled={pageState.loading}
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pageState.parentPath && loadDirectory(pageState.parentPath)}
          disabled={pageState.loading || !pageState.parentPath}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <div className="flex-1 font-mono text-sm truncate">
          {pageState.currentPath}
        </div>
        <Button 
          onClick={handleSelectCurrentFolder} 
          disabled={pageState.loading}
          size="sm"
        >
          选择此文件夹
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          {pageState.loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pageState.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Folder className="h-12 w-12 mb-3" />
              <p>空文件夹</p>
            </div>
          ) : (
            <div className="p-4 space-y-1">
              {pageState.items.map((item) => (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => handleNavigateToDirectory(item)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-accent text-left group"
                >
                  {getItemIcon(item)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    {item.type === 'project' && item.projectName && (
                      <div className="text-sm text-amber-600 truncate">Project: {item.projectName}</div>
                    )}
                    {item.type === 'version' && item.versionName && (
                      <div className="text-sm text-blue-600 truncate">Version: {item.versionName}</div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {recentFolders.length > 0 && (
          <div className="w-72 border-l p-4">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">最近打开</h3>
            <div className="space-y-1">
              {recentFolders.slice(0, 8).map((folder) => (
                <button
                  type="button"
                  key={folder.path}
                  onClick={() => handleSelectRecent(folder)}
                  disabled={pageState.loading}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left text-sm disabled:opacity-50"
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {folder.projectName} / {folder.versionName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
