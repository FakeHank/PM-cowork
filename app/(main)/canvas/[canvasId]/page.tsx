'use client';

import { useState } from 'react';
import { RefreshCw, Code, Eye, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow p-6">
    <h1 class="text-xl font-bold mb-4">Search</h1>
    <div class="flex gap-2 mb-4">
      <input type="text" placeholder="Search products..." class="flex-1 border rounded px-3 py-2" />
      <button class="bg-blue-500 text-white px-4 py-2 rounded">Search</button>
    </div>
    <div class="space-y-2">
      <div class="p-3 border rounded hover:bg-gray-50 cursor-pointer">
        <div class="font-medium">Product 1</div>
        <div class="text-sm text-gray-500">$99.00</div>
      </div>
      <div class="p-3 border rounded hover:bg-gray-50 cursor-pointer">
        <div class="font-medium">Product 2</div>
        <div class="text-sm text-gray-500">$149.00</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

export default function CanvasPage() {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setInput('');
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Canvas: Search Feature Prototype</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button
            variant={viewMode === 'code' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('code')}
          >
            <Code className="h-4 w-4 mr-1" />
            Code
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Regenerate
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          {viewMode === 'preview' ? (
            <div className="h-full rounded-lg border bg-white overflow-hidden">
              <iframe
                srcDoc={mockHtml}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                title="Canvas Preview"
              />
            </div>
          ) : (
            <div className="h-full rounded-lg border bg-muted p-4 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {mockHtml}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            placeholder="Describe changes to the prototype..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !input.trim()}
            size="icon"
            className="shrink-0 h-[60px] w-[60px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
