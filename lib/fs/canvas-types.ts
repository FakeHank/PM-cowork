// ============================================
// Canvas File Storage Types
// ============================================
// Types for Canvas metadata and page data stored in files
// Uses string dates (ISO format) for file storage compatibility

// Canvas metadata stored in canvas.json
export interface CanvasMeta {
  id: string;
  versionId: string;
  name: string;
  pages: CanvasPageMeta[];
  createdAt: string;
  updatedAt: string;
}

// Page metadata (stored in canvas.json)
export interface CanvasPageMeta {
  id: string;
  name: string;
  description?: string;
  htmlPath: string; // Relative path: pages/{pageId}.html
  createdAt: string;
  updatedAt: string;
}

// Page data with content (loaded from files)
export interface CanvasPageData extends CanvasPageMeta {
  htmlContent: string;
}

// Canvas with all page data
export interface CanvasData extends CanvasMeta {
  pages: CanvasPageData[];
}

// Git iteration log entry
export interface CanvasIterationLog {
  commitHash: string;
  message: string;
  date: string;
  pageId?: string; // Which page was modified (if any)
}
