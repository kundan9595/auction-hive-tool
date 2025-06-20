
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  showNavigation?: boolean;
}

export function Stepper({ 
  steps, 
  currentStep, 
  onStepChange, 
  canGoNext = true,
  canGoPrevious = true,
  onNext,
  onPrevious,
  showNavigation = true
}: StepperProps) {
  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div 
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 cursor-pointer transition-colors",
                index < currentStep 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : index === currentStep
                  ? "border-primary text-primary bg-background"
                  : "border-gray-300 text-gray-400 bg-background"
              )}
              onClick={() => onStepChange(index)}
            >
              {index < currentStep ? (
                <Check className="w-5 h-5" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            
            <div className="ml-3 hidden sm:block">
              <p className={cn(
                "text-sm font-medium",
                index <= currentStep ? "text-gray-900" : "text-gray-400"
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-gray-500">{step.description}</p>
              )}
            </div>
            
            {index < steps.length - 1 && (
              <div className={cn(
                "w-full h-0.5 mx-4",
                index < currentStep ? "bg-primary" : "bg-gray-300"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Navigation buttons - positioned at bottom right */}
      {showNavigation && (
        <div className="fixed bottom-6 right-6 flex gap-3 z-10">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
          )}
          
          <Button
            onClick={onNext}
            disabled={!canGoNext}
            className="flex items-center gap-2"
          >
            {currentStep === steps.length - 1 ? 'Submit All Bids' : 'Next'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
