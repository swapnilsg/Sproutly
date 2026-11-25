import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  BagIcon,
  DropIcon,
  PencilIcon,
  PotIcon,
  SproutIcon,
  SunIcon,
} from '../../components/icons';
import { RadioCardGroup, type RadioCardOption } from '../../components/RadioCardGroup';
import { track } from '../../lib/analytics';
import { firstPlantNickname, resolveGardenPlants } from '../../onboarding/answers';
import { useFinishQuestions } from '../../onboarding/saveGarden';
import { useOnboarding } from '../../stores/onboarding';
import { QuestionLayout } from './QuestionLayout';

type Ownership = 'owned' | 'not_yet';

const OWNERSHIP: RadioCardOption<Ownership>[] = [
  { id: 'owned', label: 'Yes, they’re here', icon: <PotIcon /> },
  { id: 'not_yet', label: 'Not yet — I’m getting them', icon: <BagIcon /> },
];

/** "Basil" → "basil", but keep names that start with an acronym ("ZZ plant"). */
function inSentence(name: string): string {
  return /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** "mint", "mint and chives", "mint, chives and parsley" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Onboarding step 5: meet the first plant, nickname it, and say whether the plants are home yet. */
export function StepMeetPlant() {
  const answers = useOnboarding();
  const { plants } = resolveGardenPlants(answers);
  const plant = plants[0]!;
  const others = plants.slice(1);
  const nickname = firstPlantNickname(answers);

  const [owned, setOwned] = useState<Ownership | null>(
    answers.plantsOwned === null ? null : answers.plantsOwned ? 'owned' : 'not_yet',
  );
  const shownAt = useRef(Date.now());
  const finishQuestions = useFinishQuestions();
  const questionId = useId();

  return (
    <QuestionLayout
      progress={4}
      title={`Say hi to your ${inSentence(plant.name)}!`}
      backTo="/onboarding/4"
      error={finishQuestions.error}
      cta={{
        label: 'Save my garden',
        disabled: owned === null,
        disabledLabel: 'Answer above to continue',
        loading: finishQuestions.saving,
        onClick: () => {
          const plantsOwned = owned === 'owned';
          useOnboarding.getState().setPlantsOwned(plantsOwned);
          track('onboarding_step_completed', {
            step: 5,
            plants_owned: plantsOwned,
            has_nickname: nickname !== null,
            time_on_step: Date.now() - shownAt.current,
          });
          void finishQuestions.finish();
        },
      }}
      onSkip={() => {
        track('onboarding_skipped', { step: 5 });
        useOnboarding.getState().fillDefaults();
        void finishQuestions.finish();
      }}
    >
      <section className="plant-card" aria-label={`${plant.name} care card`}>
        <span className="plant-card-emoji" aria-hidden="true">
          {plant.emoji}
        </span>
        <PlantName plantId={plant.id} name={plant.name} nickname={nickname} />
        <ul className="care-chips" aria-label="Care">
          <li className="care-chip care-chip-water">
            <DropIcon />
            {plant.care.water}
          </li>
          <li className="care-chip care-chip-sun">
            <SunIcon size={14} />
            {plant.care.light}
          </li>
          <li className="care-chip care-chip-easy">
            <SproutIcon size={14} />
            Beginner friendly
          </li>
        </ul>
        {others.length > 0 ? (
          <p className="plant-card-others">
            {capitalise(listNames(others.map((p) => inSentence(p.name))))}{' '}
            {others.length === 1 ? 'is' : 'are'} in your garden too.
          </p>
        ) : null}
      </section>

      <div className="ownership">
        <h2 id={questionId} className="ownership-question">
          {plants.length === 1 ? 'Do you have this plant yet?' : 'Do you have these plants yet?'}
        </h2>
        <RadioCardGroup<Ownership>
          name="plants-owned"
          labelledBy={questionId}
          options={OWNERSHIP}
          value={owned}
          onChange={setOwned}
          className="radio-cards-2col"
        />
      </div>
    </QuestionLayout>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The plant's name, with "Tap to give it a nickname" editable in place (max 32 characters). */
function PlantName({
  plantId,
  name,
  nickname,
}: {
  plantId: string;
  name: string;
  nickname: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const cancelled = useRef(false);

  function start() {
    cancelled.current = false;
    setDraft(nickname ?? '');
    setEditing(true);
  }

  function save() {
    if (cancelled.current) return;
    const value = draft.trim();
    useOnboarding.getState().setFirstPlantNickname(value ? { plantId, nickname: value } : null);
    setEditing(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cancelled.current = true;
      setEditing(false);
    }
  }

  return (
    <div className="plant-card-name">
      <p className="plant-card-title">{nickname ?? name}</p>
      {editing ? (
        <div className="nickname-field">
          <label htmlFor={inputId}>Nickname</label>
          <input
            id={inputId}
            value={draft}
            maxLength={32}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={onKeyDown}
            placeholder={`e.g. ${name} Brush`}
            autoFocus
          />
        </div>
      ) : (
        <button type="button" className="nickname-button" onClick={start}>
          <PencilIcon />
          {nickname ? `${name} · edit nickname` : 'Tap to give it a nickname'}
        </button>
      )}
    </div>
  );
}
