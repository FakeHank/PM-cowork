'use client';

import { useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/stores/canvas-store';

interface WorkflowProgressProps {
  onComplete: () => void;
  onError: () => void;
}

const steps = [
  { id: 'architect', name: 'Architect', description: 'Analyzing spec and designing architecture' },
  { id: 'planner', name: 'Planner', description: 'Creating implementation plan' },
  { id: 'coder', name: 'Coder', description: 'Generating HTML pages' },
  { id: 'reviewer', name: 'Reviewer', description: 'Reviewing code quality' },
] as const;

export function WorkflowProgress({ onComplete, onError }: WorkflowProgressProps) {
  const { workflowStep, workflowStatus, workflowError, workflowDetail } = useCanvasStore();

  useEffect(() => {
    if (workflowStatus === 'complete') {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [workflowStatus, onComplete]);

  const getStepStatus = (stepId: string) => {
    if (workflowStatus === 'error') {
      if (workflowStep === stepId) return 'error';
      return steps.findIndex(s => s.id === stepId) < steps.findIndex(s => s.id === workflowStep!) 
        ? 'complete' 
        : 'pending';
    }
    
    if (workflowStep === null) return 'pending';
    
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === workflowStep);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'running';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl p-8 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Generating Canvas</h2>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            
            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {status === 'pending' && (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {status === 'running' && (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  )}
                  {status === 'complete' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    status === 'running' ? 'text-primary' : 
                    status === 'complete' ? 'text-green-600' :
                    status === 'error' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {step.name}
                  </p>
                  {status === 'running' && workflowDetail && (
                    <p className="text-sm text-muted-foreground mt-1">{workflowDetail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {workflowStatus === 'error' && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">{workflowError}</p>
            <Button onClick={onError} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        )}

        {workflowStatus === 'complete' && (
          <div className="mt-6 flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">All pages generated successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
}
