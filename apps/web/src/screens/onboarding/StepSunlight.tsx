import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CloudIcon, QuestionIcon, SunCloudIcon, SunIcon } from '../../components/icons';
import { RadioCardGroup, type RadioCardOption } from '../../components/RadioCardGroup';
import { track } from '../../lib/analytics';
import { nextAfter, skipRoute, STEP_DEFAULTS, type Sunlight } from '../../onboarding/flow';
import { useAuth } from '../../stores/auth';
import { useOnboarding } from '../../stores/onboarding';
import { QuestionLayout } from './QuestionLayout';

const OPTIONS: RadioCardOption<Sunlight>[] = [
  {
    id: 'bright',
    label: 'Bright sun',
    hint: 'Sun shines on it for most of the day',
    icon: <SunIcon />,
  },
  {
    id: 'some',
    label: 'Some sun',
    hint: 'A few hours of sun, or bright light all day',
    icon: <SunCloudIcon />,
  },
  { id: 'shade', label: 'Mostly shade', hint: 'Little or no direct sun', icon: <CloudIcon /> },
  {
    id: 'unknown',
    label: 'Not sure',
    hint: 'We’ll pick plants that cope with anything',
    icon: <QuestionIcon />,
  },
];

/** Onboarding step 3: how much light the spot gets (replaces the PRD's experience-level screen). */
export function StepSunlight() {
  const navigate = useNavigate();
  const signedIn = useAuth((s) => s.session !== null);
  const saved = useOnboarding((s) => s.sunlight);
  const [sunlight, setSunlight] = useState<Sunlight>(saved ?? STEP_DEFAULTS.sunlight);
  const shownAt = useRef(Date.now());

  return (
    <QuestionLayout
      progress={2}
      title="How sunny is that spot?"
      titleId="sunlight-question"
      sub="Your best guess is fine — you can change it later."
      backTo="/onboarding/2"
      cta={{
        label: 'Show me plants that fit',
        onClick: () => {
          track('onboarding_step_completed', {
            step: 3,
            sunlight,
            time_on_step: Date.now() - shownAt.current,
          });
          useOnboarding.getState().setSunlight(sunlight);
          navigate(nextAfter(3, signedIn));
        },
      }}
      onSkip={() => {
        track('onboarding_skipped', { step: 3 });
        useOnboarding.getState().fillDefaults();
        navigate(skipRoute(signedIn));
      }}
    >
      <RadioCardGroup<Sunlight>
        name="sunlight"
        labelledBy="sunlight-question"
        options={OPTIONS}
        value={sunlight}
        onChange={setSunlight}
        iconTone="warm"
      />
    </QuestionLayout>
  );
}
