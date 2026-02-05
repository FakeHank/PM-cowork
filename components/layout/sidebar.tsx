'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Inbox, 
  FolderKanban, 
  Layout, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppStore, useRecentsStore } from '@/stores/app-store';
import { ResizeHandle } from './resize-handle';

const navItems = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/workspace', label: 'Workspace', icon: FolderKanban },
  { href: '/canvas', label: 'Canvas', icon: Layout },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth, setActiveSession } = useAppStore();
  const { chats } = useRecentsStore();

  const handleResize = (delta: number) => {
    setSidebarWidth(sidebarWidth + delta);
  };

  if (sidebarCollapsed) {
    return (
      <aside className="flex flex-col border-r border-border/70 bg-muted/30 w-16 shadow-[1px_0_8px_rgba(0,0,0,0.04)] dark:shadow-[1px_0_8px_rgba(0,0,0,0.35)]">
        <div className="flex h-14 items-center justify-center border-b">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 py-4">
          <div className="px-3 mb-4">
            <Button className="w-full justify-center px-2" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-center rounded-md px-2 py-2 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex">
      <aside 
        className="flex flex-col border-r border-border/70 bg-muted/30 shadow-[1px_0_8px_rgba(0,0,0,0.04)] dark:shadow-[1px_0_8px_rgba(0,0,0,0.35)]"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b">
          <span className="font-semibold text-lg">PMWork</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 py-4">
          <div className="px-3 mb-4">
            <Button className="w-full justify-start gap-2" size="sm">
              <Plus className="h-4 w-4" />
              <span>New</span>
            </Button>
          </div>

          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Separator className="my-4" />

          <div className="px-3">
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Recents</span>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              {chats.length === 0 ? (
                <div className="px-3 py-1 text-muted-foreground truncate">No recent items</div>
              ) : (
                chats.map((chat) => {
                  const isActive = pathname.startsWith(chat.href);
                  return (
                    <button
                      key={chat.key}
                      type="button"
                      onClick={() => {
                        if (chat.kind === 'workspace' && chat.sessionId && chat.versionId) {
                          setActiveSession({ versionId: chat.versionId, sessionId: chat.sessionId });
                        }
                        router.push(chat.href);
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-accent text-accent-foreground'
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        {chat.kind === 'workspace' ? (
                          <FolderKanban className="h-4 w-4" />
                        ) : (
                          <Layout className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{chat.title}</span>
                        {chat.context && (
                          <span className="block truncate text-xs text-muted-foreground/80">
                            {chat.context}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>
      <ResizeHandle side="left" onResize={handleResize} />
    </div>
  );
}
