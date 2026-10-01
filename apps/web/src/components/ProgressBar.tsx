const SEGMENTS = 5;

/** Onboarding progress over steps 2–6: `step` is the current segment, 1–5. */
export function ProgressBar({ step }: { step: number }) {
  return (
    <div className="progress">
      <div className="progress-track" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`progress-segment ${i + 1 < step ? 'is-done' : i + 1 === step ? 'is-current' : ''}`}
          />
        ))}
      </div>
      <span className="progress-label">
        {step} of {SEGMENTS}
      </span>
    </div>
  );
}
