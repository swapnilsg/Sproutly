import {
  getPack,
  getPlant,
  MAX_CUSTOM_PLANTS,
  needsMoreSun,
  PACKS,
  plantsForLight,
  recommendPack,
  type Plant,
} from '@sproutly/catalogue';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { PinIcon, SunIcon } from '../../components/icons';
import { RadioCardGroup, type RadioCardOption } from '../../components/RadioCardGroup';
import { track } from '../../lib/analytics';
import { useCityGuess } from '../../onboarding/cityGuess';
import { nextAfter, skipRoute, STEP_DEFAULTS } from '../../onboarding/flow';
import { useAuth } from '../../stores/auth';
import { useOnboarding, type GardenLocation } from '../../stores/onboarding';
import { QuestionLayout } from './QuestionLayout';

/** Onboarding step 4: a starter pack picked for the user's space and light, or up to 5 plants. */
export function StepPack() {
  const navigate = useNavigate();
  const signedIn = useAuth((s) => s.session !== null);
  const saved = useOnboarding();
  const spaceTypes = saved.spaceTypes ?? STEP_DEFAULTS.spaceTypes;
  const sunlight = saved.sunlight ?? STEP_DEFAULTS.sunlight;
  const recommended = recommendPack(spaceTypes, sunlight);

  const [mode, setMode] = useState<'pack' | 'custom'>(
    saved.customPlantIds.length > 0 ? 'custom' : 'pack',
  );
  const [packId, setPackId] = useState(saved.packId ?? recommended.id);
  const [customIds, setCustomIds] = useState<string[]>(saved.customPlantIds);
  const shownAt = useRef(Date.now());
  useCityGuess();

  const packs = [recommended, ...PACKS.filter((p) => p.id !== recommended.id)];
  const options: RadioCardOption<string>[] = packs.map((pack) => ({
    id: pack.id,
    icon: <span className="emoji-icon">{pack.emoji}</span>,
    label: (
      <>
        {pack.id === recommended.id ? <span className="pack-badge">Best for your spot</span> : null}
        <span>{pack.name}</span>
      </>
    ),
    hint: (
      <>
        <span>{pack.description}</span>
        {needsMoreSun(pack, sunlight) ? (
          <span className="pack-needs-sun">
            <SunIcon size={15} />
            Needs more sun than your spot gets
          </span>
        ) : null}
      </>
    ),
  }));

  function finish() {
    const store = useOnboarding.getState();
    if (mode === 'custom') {
      store.setCustomPlants(customIds);
      track('starter_pack_selected', { custom: true, count: customIds.length });
    } else {
      store.setPack(packId);
      track('starter_pack_selected', {
        pack_id: packId,
        pack_name: getPack(packId)?.name,
        recommended: packId === recommended.id,
      });
    }
    track('onboarding_step_completed', { step: 4, time_on_step: Date.now() - shownAt.current });
    navigate(nextAfter(4, signedIn));
  }

  return (
    <QuestionLayout
      progress={3}
      title="Start with a bundle?"
      titleId="pack-question"
      sub="We’ve picked plants that suit your spot — all easy to keep alive."
      backTo="/onboarding/3"
      cta={{
        label: 'Add these to my garden',
        disabled: mode === 'custom' && customIds.length === 0,
        disabledLabel: 'Pick at least one plant',
        onClick: finish,
      }}
      onSkip={() => {
        track('onboarding_skipped', { step: 4 });
        useOnboarding.getState().fillDefaults();
        navigate(skipRoute(signedIn));
      }}
    >
      <LocationChip />

      {mode === 'pack' ? (
        <>
          <RadioCardGroup<string>
            name="pack"
            labelledBy="pack-question"
            options={options}
            value={packId}
            onChange={setPackId}
          />
          <button type="button" className="text-link" onClick={() => setMode('custom')}>
            Choose my own plants
          </button>
        </>
      ) : (
        <PlantPicker
          plants={plantsFor(sunlight, customIds)}
          selected={customIds}
          onChange={setCustomIds}
          onUseBundle={() => setMode('pack')}
        />
      )}
    </QuestionLayout>
  );
}

/** Plants that suit the light, plus anything already picked (answers can change between steps). */
function plantsFor(sunlight: Parameters<typeof plantsForLight>[0], picked: string[]): Plant[] {
  const fitting = plantsForLight(sunlight);
  const extra = picked
    .filter((id) => !fitting.some((p) => p.id === id))
    .map((id) => getPlant(id))
    .filter((p): p is Plant => Boolean(p));
  return [...fitting, ...extra];
}

function PlantPicker({
  plants,
  selected,
  onChange,
  onUseBundle,
}: {
  plants: Plant[];
  selected: string[];
  onChange(ids: string[]): void;
  onUseBundle(): void;
}) {
  const headingId = useId();
  const full = selected.length >= MAX_CUSTOM_PLANTS;
  return (
    <div className="plant-picker">
      <div className="plant-picker-head">
        <h2 id={headingId} className="plant-picker-title">
          Choose up to {MAX_CUSTOM_PLANTS} plants
        </h2>
        <span className="plant-picker-count" aria-live="polite">
          {selected.length} of {MAX_CUSTOM_PLANTS} chosen
        </span>
      </div>
      <div role="group" aria-labelledby={headingId} className="plant-picker-list">
        {plants.map((plant) => {
          const checked = selected.includes(plant.id);
          return (
            <label
              key={plant.id}
              className={`plant-option${checked ? ' is-checked' : ''}${!checked && full ? ' is-disabled' : ''}`}
            >
              <span className="plant-option-emoji" aria-hidden="true">
                {plant.emoji}
              </span>
              <span className="plant-option-text">
                <span className="plant-option-name">{plant.name}</span>
                <span className="plant-option-hint">
                  {plant.care.light} · {plant.care.water.toLowerCase()}
                </span>
              </span>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && full}
                onChange={() =>
                  onChange(
                    checked ? selected.filter((id) => id !== plant.id) : [...selected, plant.id],
                  )
                }
              />
            </label>
          );
        })}
      </div>
      <button type="button" className="text-link" onClick={onUseBundle}>
        Use a bundle instead
      </button>
    </div>
  );
}

/** "Growing in Bengaluru · Change", or "Add your city (optional)", editable in place. */
function LocationChip() {
  const location = useOnboarding((s) => s.location);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();

  function startEditing() {
    setDraft(location?.city ?? location?.raw ?? '');
    setEditing(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    const next: GardenLocation | null = text
      ? { raw: text, city: text, countryCode: null, source: 'user' }
      : null;
    useOnboarding.getState().setLocation(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <form className="location-edit" onSubmit={save}>
        <div className="location-edit-field">
          <label htmlFor={inputId} className="field-label">
            City
          </label>
          <input
            id={inputId}
            className="field-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Bengaluru"
            autoComplete="address-level2"
            maxLength={80}
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary location-edit-done">
          Done
        </button>
      </form>
    );
  }

  if (location?.city) {
    return (
      <p className="location-chip">
        <PinIcon />
        <span>
          Growing in <strong>{location.city}</strong>
        </span>
        <button type="button" className="location-chip-change" onClick={startEditing}>
          Change<span className="visually-hidden"> city</span>
        </button>
      </p>
    );
  }

  return (
    <button type="button" className="location-chip location-chip-add" onClick={startEditing}>
      <PinIcon />
      Add your city (optional)
    </button>
  );
}
