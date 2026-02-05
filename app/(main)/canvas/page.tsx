'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CanvasIndexPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Palette className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">No Canvas Selected</h1>
      <p className="text-muted-foreground text-center max-w-md">
        To create or view a canvas, go to a project workspace and click the "Generate Canvas" button.
      </p>
      <Button onClick={() => router.push('/workspace')}>
        Go to Workspace
      </Button>
    </div>
  );
}
