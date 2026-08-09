import { useState } from 'preact/hooks';
import { CONFIG } from '../config.js';

export function AddPlantForm({ data, onSubmit, onAddSchedule, onCancel, defaultValues }) {
  const [name, setName] = useState(defaultValues?.name || '');
  const [species, setSpecies] = useState(defaultValues?.species || '');
  const [caretaker, setCaretaker] = useState(defaultValues?.caretaker || 'Josh');
  const [location, setLocation] = useState(defaultValues?.location || '');
  const [acquiredDate, setAcquiredDate] = useState(
    defaultValues?.acquiredDate || new Date().toISOString().split('T')[0]
  );
  const [pot, setPot] = useState(defaultValues?.pot || '');
  const [notes, setNotes] = useState(defaultValues?.notes || '');
  const [light, setLight] = useState(defaultValues?.light || '');
  const [water, setWater] = useState(defaultValues?.water || '');
  const [humidity, setHumidity] = useState(defaultValues?.humidity || '');
  const [fertilizing, setFertilizing] = useState(defaultValues?.fertilizing || '');
  const [submitting, setSubmitting] = useState(false);

  // Schedule management after adding plant
  const [plantAdded, setPlantAdded] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [schedEventType, setSchedEventType] = useState('');
  const [schedCadence, setSchedCadence] = useState('');

  const caretakers = [...new Set(Object.values(CONFIG.CARETAKER_MAP))];
  const speciesNames = data.species?.map((s) => s.name) || [];
  const existingLocations = [
    ...new Set(data.inventory?.map((p) => p.location).filter(Boolean)),
  ].sort();

  const handleSpeciesChange = (value) => {
    setSpecies(value);
    const match = data.species?.find(
      (s) => s.name === value || s.scientificName === value
    );
    if (match) {
      if (!light) setLight(match.light || '');
      if (!water) setWater(match.water || '');
      if (!humidity) setHumidity(match.humidity || '');
      if (!fertilizing) setFertilizing(match.food || '');
    }
  };

  const handleSubmitPlant = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        species,
        caretaker,
        location: location.trim(),
        acquiredDate,
        pot: pot.trim(),
        notes: notes.trim(),
        light: light.trim(),
        water: water.trim(),
        humidity: humidity.trim(),
        fertilizing: fertilizing.trim(),
      });
      setPlantAdded(true);
    } catch (err) {
      console.error('Failed to add plant:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!schedEventType || !schedCadence) return;
    try {
      await data.addSchedule(name.trim(), parseInt(schedCadence, 10), schedEventType);
      setSchedules((prev) => [
        ...prev,
        { eventType: schedEventType, cadence: parseInt(schedCadence, 10) },
      ]);
    } catch (err) {
      console.error('Failed to add schedule:', err);
    }
    setSchedEventType('');
    setSchedCadence('');
  };

  const handleDone = () => {
    onCancel();
  };

  if (plantAdded) {
    return (
      <main class="add-plant-form">
        <h2>Add Care Schedules</h2>
        <p class="form-subtitle">
          Set up care schedules for <strong>{name}</strong>
        </p>

        {schedules.length > 0 && (
          <div class="schedules-added">
            {schedules.map((s, i) => (
              <div key={i} class="schedule-added-row">
                <span>{s.eventType}</span>
                <span>Every {s.cadence} days</span>
              </div>
            ))}
          </div>
        )}

        <div class="form-row">
          <select
            value={schedEventType}
            onChange={(e) => setSchedEventType(e.target.value)}
            class="form-select"
          >
            <option value="">Select event type</option>
            {(data.eventTypes || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            placeholder="Days"
            value={schedCadence}
            onChange={(e) => setSchedCadence(e.target.value)}
            class="form-input form-input-short"
          />
          <button
            type="button"
            class="btn btn-primary btn-add-schedule"
            onClick={handleAddSchedule}
            disabled={!schedEventType || !schedCadence}
          >
            Add
          </button>
        </div>

        <button type="button" class="btn btn-primary btn-full" onClick={handleDone}>
          Done
        </button>
      </main>
    );
  }

  return (
    <main class="add-plant-form">
      <button class="btn btn-back" onClick={onCancel}>
        ← Back
      </button>
      <h2>Add New Plant</h2>

      <form onSubmit={handleSubmitPlant}>
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input
            type="text"
            class="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Monstera"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Species</label>
          <input
            type="text"
            class="form-input"
            value={species}
            onChange={(e) => handleSpeciesChange(e.target.value)}
            list="species-list"
            placeholder="Start typing..."
          />
          <datalist id="species-list">
            {speciesNames.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div class="form-group">
          <label class="form-label">Caretaker</label>
          <select
            class="form-select"
            value={caretaker}
            onChange={(e) => setCaretaker(e.target.value)}
          >
            {caretakers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Location</label>
          <input
            type="text"
            class="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            list="location-list"
            placeholder="e.g. Living Room"
          />
          <datalist id="location-list">
            {existingLocations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>

        <div class="form-group">
          <label class="form-label">Acquired Date</label>
          <input
            type="date"
            class="form-input"
            value={acquiredDate}
            onChange={(e) => setAcquiredDate(e.target.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label">Pot</label>
          <input
            type="text"
            class="form-input"
            value={pot}
            onChange={(e) => setPot(e.target.value)}
            placeholder="e.g. Terracotta 8 inch"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea
            class="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="3"
            placeholder="Any notes about this plant..."
          />
        </div>

        <div class="form-group">
          <label class="form-label">Light</label>
          <textarea
            class="form-textarea"
            value={light}
            onChange={(e) => setLight(e.target.value)}
            rows="2"
            placeholder="Light requirements..."
          />
        </div>

        <div class="form-group">
          <label class="form-label">Water</label>
          <textarea
            class="form-textarea"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            rows="2"
            placeholder="Watering instructions..."
          />
        </div>

        <div class="form-group">
          <label class="form-label">Humidity</label>
          <textarea
            class="form-textarea"
            value={humidity}
            onChange={(e) => setHumidity(e.target.value)}
            rows="2"
            placeholder="Humidity preferences..."
          />
        </div>

        <div class="form-group">
          <label class="form-label">Fertilizing</label>
          <textarea
            class="form-textarea"
            value={fertilizing}
            onChange={(e) => setFertilizing(e.target.value)}
            rows="2"
            placeholder="Fertilizing schedule..."
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-full"
          disabled={submitting || !name.trim()}
        >
          {submitting ? 'Adding...' : 'Add Plant'}
        </button>
      </form>
    </main>
  );
}
