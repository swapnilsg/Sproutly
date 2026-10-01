import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BalconyIcon, CheckIcon, IndoorsIcon, SproutIcon } from '../../components/icons';
import { track } from '../../lib/analytics';
import { nextAfter, STEP_DEFAULTS, toggleSpace, type SpaceType } from '../../onboarding/flow';
import { useAuth } from '../../stores/auth';
import { useOnboarding } from '../../stores/onboarding';
import { QuestionLayout } from './QuestionLayout';

const OPTIONS: { id: SpaceType; name: string; hint: string; icon: ReactNode }[] = [
  {
    id: 'balcony',
    name: 'Balcony',
    hint: 'Pots, railings and window boxes',
    icon: <BalconyIcon />,
  },
  { id: 'indoors', name: 'Indoors', hint: 'Windowsills, shelves and rooms', icon: <IndoorsIcon /> },
  { id: 'unknown', name: 'Not sure yet', hint: 'We’ll suggest easy options', icon: <SproutIcon /> },
];

/** Onboarding step 2: where the plants will live (multi-select; "Not sure yet" is exclusive). */
export function StepSpace() {
  const navigate = useNavigate();
  const signedIn = useAuth((s) => s.session !== null);
  const saved = useOnboarding((s) => s.spaceTypes);
  const [selected, setSelected] = useState<SpaceType[]>(saved ?? STEP_DEFAULTS.spaceTypes);
  const shownAt = useRef(Date.now());

  function finish(spaceTypes: SpaceType[]) {
    useOnboarding.getState().setSpaceTypes(spaceTypes);
    navigate(nextAfter(2, signedIn));
  }

  return (
    <QuestionLayout
      progress={1}
      title="Where will your plants live?"
      titleId="space-question"
      sub="Pick all that apply."
      backTo={signedIn ? null : '/onboarding/1'}
      cta={{
        label: 'That’s where they’ll live',
        disabled: selected.length === 0,
        disabledLabel: 'Pick at least one place',
        onClick: () => {
          track('onboarding_step_completed', {
            step: 2,
            space_types: selected,
            time_on_step: Date.now() - shownAt.current,
          });
          finish(selected);
        },
      }}
      onSkip={() => {
        track('onboarding_skipped', { step: 2 });
        finish(saved ?? STEP_DEFAULTS.spaceTypes);
      }}
    >
      <div className="choice-list" role="group" aria-labelledby="space-question">
        {OPTIONS.map((option) => {
          const pressed = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="choice-tile"
              aria-pressed={pressed}
              onClick={() => setSelected((current) => toggleSpace(current, option.id))}
            >
              <span className="choice-tile-icon">{option.icon}</span>
              <span className="choice-tile-text">
                <span className="choice-tile-name">{option.name}</span>
                <span className="choice-tile-hint">{option.hint}</span>
              </span>
              <span className="choice-tile-check">{pressed ? <CheckIcon /> : null}</span>
            </button>
          );
        })}
      </div>
    </QuestionLayout>
  );
}
