import { Check } from 'lucide-react';
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
}

export function Stepper({ 
  steps, 
  currentStep, 
  onStepChange, 
}: StepperProps) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicators - only numbers */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div 
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full border-2 cursor-pointer transition-colors",
                index < currentStep 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : index === currentStep
                  ? "border-primary text-primary bg-background"
                  : "border-gray-300 text-gray-400 bg-background"
              )}
              onClick={() => onStepChange(index)}
            >
              {index < currentStep ? (
                <Check className="w-6 h-6" />
              ) : (
                <span className="text-lg font-semibold">{index + 1}</span>
              )}
            </div>
            
            {index < steps.length - 1 && (
              <div className={cn(
                "w-16 h-0.5 mx-4",
                index < currentStep ? "bg-primary" : "bg-gray-300"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
