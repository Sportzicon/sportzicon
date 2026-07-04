import { Check } from "lucide-react";

export type WizardStepDef = {
  title: string;
  subtitle?: string;
};

type Props = {
  steps: WizardStepDef[];
  currentStep: number; // 0-indexed
  canProceed: boolean;
  isLastStep: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  error?: string;
  draftSavedAt?: Date | null;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onDiscardDraft?: () => void;
  children: React.ReactNode;
};

export function Wizard({
  steps,
  currentStep,
  canProceed,
  isLastStep,
  isSubmitting = false,
  submitLabel = "Create",
  error,
  draftSavedAt,
  onBack,
  onNext,
  onSubmit,
  onDiscardDraft,
  children,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                i === currentStep
                  ? "bg-blue-50 text-blue-700"
                  : i < currentStep
                  ? "text-emerald-600"
                  : "text-slate-400"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  i === currentStep
                    ? "bg-blue-600 text-white"
                    : i < currentStep
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < currentStep ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium leading-tight">{step.title}</div>
                {step.subtitle && (
                  <div className="text-xs opacity-70 leading-tight">{step.subtitle}</div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 mx-1 flex-shrink-0 transition-colors ${
                  i < currentStep ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}

        {/* Draft indicator */}
        {draftSavedAt && onDiscardDraft && (
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>Draft auto-saved</span>
            <button
              className="text-red-500 hover:text-red-700 underline"
              onClick={onDiscardDraft}
            >
              Discard draft
            </button>
          </div>
        )}
      </div>

      {/* Step content */}
      <div className="card card-body">
        <div className="mb-5 pb-4 border-b border-slate-100">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
            Step {currentStep + 1} of {steps.length}
          </div>
          <h3 className="text-lg font-semibold text-slate-800">{steps[currentStep].title}</h3>
          {steps[currentStep].subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{steps[currentStep].subtitle}</p>
          )}
        </div>
        {children}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          className="btn-secondary"
          onClick={onBack}
          disabled={currentStep === 0}
        >
          ← Back
        </button>
        {isLastStep ? (
          <button
            className="btn-primary px-6"
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
          >
            {isSubmitting ? "Creating…" : submitLabel}
          </button>
        ) : (
          <button
            className="btn-primary px-6"
            onClick={onNext}
            disabled={!canProceed}
          >
            Save & Continue →
          </button>
        )}
      </div>
    </div>
  );
}
