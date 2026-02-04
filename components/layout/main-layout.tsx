'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { RightPanel } from './right-panel';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  
  const showRightPanel = pathname.startsWith('/workspace/') && pathname.split('/').length > 2;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      {showRightPanel && <RightPanel />}
    </div>
  );
}
