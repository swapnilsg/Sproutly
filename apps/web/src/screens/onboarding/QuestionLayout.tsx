import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { BackIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';

interface Props {
  /** Progress segment, 1–5 (step 2 is 1). */
  progress: number;
  title: string;
  /** id for the heading, so a question group can use it as its label. */
  titleId?: string;
  sub?: string;
  /** Where the back button goes; no back button when null. */
  backTo: string | null;
  cta: { label: string; onClick(): void; disabled?: boolean; disabledLabel?: string };
  onSkip(): void;
  children: ReactNode;
}

/** Shared shell for the onboarding question steps (2–5). */
export function QuestionLayout({
  progress,
  title,
  titleId,
  sub,
  backTo,
  cta,
  onSkip,
  children,
}: Props) {
  return (
    <main className="question">
      <header className="question-header">
        {backTo ? (
          <Link to={backTo} className="question-back" aria-label="Back">
            <BackIcon />
          </Link>
        ) : (
          <span className="question-back-spacer" />
        )}
        <ProgressBar step={progress} />
      </header>

      <section className="question-body">
        <div className="question-intro">
          <h1 id={titleId} className="question-title">
            {title}
          </h1>
          {sub ? <p className="question-sub">{sub}</p> : null}
        </div>
        {children}
      </section>

      <footer className="question-footer">
        <Button className="btn-cta" onClick={cta.onClick} disabled={cta.disabled}>
          {cta.disabled && cta.disabledLabel ? cta.disabledLabel : cta.label}
        </Button>
        <button type="button" className="question-skip" onClick={onSkip}>
          Skip for now
        </button>
      </footer>
    </main>
  );
}
