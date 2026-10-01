import type { ReactNode } from 'react';

export interface RadioCardOption<T extends string> {
  id: T;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

interface Props<T extends string> {
  /** Shared `name` for the native radios. */
  name: string;
  /** id of the visible question heading that labels the group. */
  labelledBy: string;
  options: RadioCardOption<T>[];
  /** null = nothing chosen yet (no radio checked). */
  value: T | null;
  onChange(value: T): void;
  /** Extra class for layout variants, e.g. a two-column grid. */
  className?: string;
  /** Tone for the icon tile: green (default) or warm (sunlight). */
  iconTone?: 'green' | 'warm';
}

/** Single-choice cards built on native radios: arrow keys, Space and screen readers work as usual. */
export function RadioCardGroup<T extends string>({
  name,
  labelledBy,
  options,
  value,
  onChange,
  className,
  iconTone = 'green',
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={['radio-cards', className].filter(Boolean).join(' ')}
    >
      {options.map((option) => {
        const checked = value === option.id;
        return (
          <label key={option.id} className={`radio-card${checked ? ' is-checked' : ''}`}>
            {option.icon ? (
              <span className={`radio-card-icon radio-card-icon-${iconTone}`} aria-hidden="true">
                {option.icon}
              </span>
            ) : null}
            <span className="radio-card-text">
              <span className="radio-card-label">{option.label}</span>
              {option.hint ? <span className="radio-card-hint">{option.hint}</span> : null}
            </span>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={checked}
              onChange={() => onChange(option.id)}
              className="radio-card-input"
            />
          </label>
        );
      })}
    </div>
  );
}
