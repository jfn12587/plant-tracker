import { useState } from 'preact/hooks';
import { getPhotoUrl } from '../services/drive.js';
import { PhotoCapture } from './PhotoCapture.jsx';

export function PlantDetail({ plant, data, onBack, onAction, onRemove, onPropagate }) {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editCadence, setEditCadence] = useState('');
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newSchedType, setNewSchedType] = useState('');
  const [newSchedCadence, setNewSchedCadence] = useState('');
  const [loggingEvent, setLoggingEvent] = useState(false);
  const [adHocType, setAdHocType] = useState('');
  const [adHocDate, setAdHocDate] = useState('');

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(plant.name || '');
  const [editLocation, setEditLocation] = useState(plant.location || '');
  const [editCaretaker, setEditCaretaker] = useState(plant.caretaker || '');
  const [editPot, setEditPot] = useState(plant.pot || '');
  const [editNotes, setEditNotes] = useState(plant.notes || '');
  const [saving, setSaving] = useState(false);

  const speciesInfo = data.species?.find(
    (s) => s.name === plant.species || s.name === plant.name
  );

  const plantSchedules = data.scheduleStatuses?.filter(
    (s) => s.plantId === plant.id
  );

  // All events for this plant, grouped by event type with last-done date
  const plantEvents = (data.events || []).filter((e) => e.plantId === plant.id);
  const activityByType = new Map();
  for (const event of plantEvents) {
    if (!activityByType.has(event.eventType)) {
      activityByType.set(event.eventType, { lastDone: null, count: 0 });
    }
    const entry = activityByType.get(event.eventType);
    entry.count++;
    if (event.outcome === 'Done') {
      const ts = new Date(event.timestamp);
      if (!entry.lastDone || ts > entry.lastDone) {
        entry.lastDone = ts;
      }
    }
  }

  const photoUrl = plant.photo ? getPhotoUrl(plant.photo) : null;

  const handleLogAdHocEvent = async () => {
    if (!adHocType) return;
    const ts = adHocDate ? new Date(adHocDate + 'T12:00:00').toISOString() : undefined;
    await data.logEvent(plant.id, adHocType, 'Done', ts);
    setAdHocType('');
    setAdHocDate('');
    setLoggingEvent(false);
  };

  const handlePhotoUpload = async (file) => {
    await data.uploadPlantPhoto(plant.id, file);
  };

  const handleRemove = async () => {
    await onRemove(plant.id);
  };

  const handleEditSchedule = (eventType, cadence) => {
    setEditingSchedule(eventType);
    setEditCadence(String(cadence));
  };

  const handleSaveSchedule = async () => {
    if (!editCadence) return;
    await data.updateSchedule(plant.id, editingSchedule, parseInt(editCadence, 10));
    setEditingSchedule(null);
    setEditCadence('');
  };

  const handleRemoveSchedule = async (eventType) => {
    await data.removeSchedule(plant.id, eventType);
  };

  const handleAddSchedule = async () => {
    if (!newSchedType || !newSchedCadence) return;
    await data.addSchedule(plant.id, parseInt(newSchedCadence, 10), newSchedType);
    setNewSchedType('');
    setNewSchedCadence('');
    setAddingSchedule(false);
  };

  const handleStartEdit = () => {
    setEditName(plant.name || '');
    setEditLocation(plant.location || '');
    setEditCaretaker(plant.caretaker || '');
    setEditPot(plant.pot || '');
    setEditNotes(plant.notes || '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await data.updatePlant(plant.id, {
        name: editName.trim(),
        location: editLocation.trim(),
        caretaker: editCaretaker.trim(),
        pot: editPot.trim(),
        notes: editNotes.trim(),
      });
      // Update local plant reference so UI reflects changes immediately
      plant.name = editName.trim();
      plant.location = editLocation.trim();
      plant.caretaker = editCaretaker.trim();
      plant.pot = editPot.trim();
      plant.notes = editNotes.trim();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save plant edits:', err);
    } finally {
      setSaving(false);
    }
  };

  // Event types not already scheduled for this plant
  const availableEventTypes = (data.eventTypes || []).filter(
    (t) => !plantSchedules?.some((s) => s.eventType === t)
  );

  return (
    <main class="plant-detail">
      <button class="btn btn-back" onClick={onBack}>
        ← Back
      </button>

      {photoUrl && (
        <div class="plant-photo-container">
          <img src={photoUrl} alt={plant.name} class="plant-photo" />
        </div>
      )}

      {editing ? (
        <div class="form-group">
          <label class="form-label">Name</label>
          <input
            type="text"
            class="form-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>
      ) : (
        <h2>{plant.name}</h2>
      )}
      {plant.species && <p class="species-name">{plant.species}</p>}

      <div class="detail-actions-bar">
        {!editing && (
          <button class="btn btn-small btn-edit-plant" onClick={handleStartEdit}>
            Edit
          </button>
        )}
        {onPropagate && !editing && (
          <button class="btn btn-small btn-propagate" onClick={() => onPropagate(plant)}>
            Propagate
          </button>
        )}
      </div>

      <div class="quick-actions">
        <button class="btn btn-quick btn-quick-water" onClick={() => data.logEvent(plant.id, 'Water', 'Done')}>
          💧 Water
        </button>
        <button class="btn btn-quick btn-quick-fertilize" onClick={() => data.logEvent(plant.id, 'Fertilize', 'Done')}>
          🌿 Fertilize
        </button>
        <button class="btn btn-quick btn-quick-repot" onClick={() => data.logEvent(plant.id, 'Repot', 'Done')}>
          🪴 Repot
        </button>
      </div>

      <div class="photo-section">
        <PhotoCapture onUpload={handlePhotoUpload} />
      </div>

      <div class="detail-grid">
        {editing ? (
          <>
            <div class="detail-item">
              <label class="form-label">Location</label>
              <input
                type="text"
                class="form-input"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>
            <div class="detail-item">
              <label class="form-label">Caretaker</label>
              <input
                type="text"
                class="form-input"
                value={editCaretaker}
                onChange={(e) => setEditCaretaker(e.target.value)}
              />
            </div>
            {plant.acquiredDate && (
              <div class="detail-item">
                <label>Acquired</label>
                <span>{plant.acquiredDate}</span>
              </div>
            )}
            <div class="detail-item">
              <label class="form-label">Pot</label>
              <input
                type="text"
                class="form-input"
                value={editPot}
                onChange={(e) => setEditPot(e.target.value)}
              />
            </div>
            <div class="detail-item full-width">
              <label class="form-label">Notes</label>
              <textarea
                class="form-textarea"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows="3"
              />
            </div>
            <div class="detail-item full-width edit-buttons">
              <button class="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button class="btn btn-small" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {plant.location && (
              <div class="detail-item">
                <label>Location</label>
                <span>{plant.location}</span>
              </div>
            )}
            {plant.caretaker && (
              <div class="detail-item">
                <label>Caretaker</label>
                <span>{plant.caretaker}</span>
              </div>
            )}
            {plant.acquiredDate && (
              <div class="detail-item">
                <label>Acquired</label>
                <span>{plant.acquiredDate}</span>
              </div>
            )}
            {plant.pot && (
              <div class="detail-item">
                <label>Pot</label>
                <span>{plant.pot}</span>
              </div>
            )}
            {plant.notes && (
              <div class="detail-item full-width">
                <label>Notes</label>
                <span>{plant.notes}</span>
              </div>
            )}
          </>
        )}
      </div>

      <section class="detail-section">
        <h3>Activity</h3>
        {activityByType.size > 0 ? (
          <div class="activity-list">
            {Array.from(activityByType.entries()).map(([type, info]) => {
              const schedule = plantSchedules?.find((s) => s.eventType === type);
              return (
                <div key={type} class="activity-row">
                  <span class="activity-type">{type}</span>
                  <span class="activity-last-done">
                    {info.lastDone
                      ? `Last: ${info.lastDone.toLocaleDateString()}`
                      : 'Never completed'}
                  </span>
                  {schedule && (
                    <span class="activity-schedule">
                      Every {schedule.cadence}d
                    </span>
                  )}
                  <span class="activity-count">{info.count} total</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p class="empty-schedule">No activity recorded yet.</p>
        )}

        {loggingEvent ? (
          <div class="schedule-add-form">
            <select
              value={adHocType}
              onChange={(e) => setAdHocType(e.target.value)}
              class="form-select"
            >
              <option value="">Select event type</option>
              {(data.eventTypes || []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              class="form-input"
              value={adHocDate}
              onChange={(e) => setAdHocDate(e.target.value)}
              placeholder="Date (optional)"
            />
            <button
              class="btn btn-small btn-save"
              onClick={handleLogAdHocEvent}
              disabled={!adHocType}
            >
              Log Done
            </button>
            <button class="btn btn-small" onClick={() => setLoggingEvent(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            class="btn btn-small btn-add-schedule-inline"
            onClick={() => setLoggingEvent(true)}
          >
            + Log Event
          </button>
        )}
      </section>

      {plantSchedules && plantSchedules.length > 0 && (
        <section class="detail-section">
          <h3>Care Schedule</h3>
          {plantSchedules.map((s) => (
            <div key={s.eventType} class="schedule-row">
              {editingSchedule === s.eventType ? (
                <div class="schedule-edit-row">
                  <span class="schedule-type">{s.eventType}</span>
                  <input
                    type="number"
                    min="1"
                    value={editCadence}
                    onChange={(e) => setEditCadence(e.target.value)}
                    class="form-input form-input-short"
                  />
                  <span class="schedule-cadence-label">days</span>
                  <button class="btn btn-small btn-save" onClick={handleSaveSchedule}>
                    Save
                  </button>
                  <button
                    class="btn btn-small"
                    onClick={() => setEditingSchedule(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span class="schedule-type">{s.eventType}</span>
                  <span class="schedule-cadence">Every {s.cadence} days</span>
                  <span class={`schedule-status ${s.daysOverdue >= 0 ? 'overdue' : ''}`}>
                    {s.nextDue
                      ? s.daysOverdue > 0
                        ? `${s.daysOverdue}d overdue`
                        : s.daysOverdue === 0
                          ? 'Due today'
                          : `In ${Math.abs(s.daysOverdue)}d`
                      : 'Never done'}
                  </span>
                  <div class="schedule-actions">
                    <button class="btn btn-action btn-done" onClick={() => onAction('Done')}>
                      ✓
                    </button>
                    <button class="btn btn-action btn-snooze" onClick={() => onAction('Snoozed')}>
                      ⏰
                    </button>
                    <button class="btn btn-action btn-skip" onClick={() => onAction('Skipped')}>
                      ⏭
                    </button>
                    <button
                      class="btn btn-action btn-edit"
                      onClick={() => handleEditSchedule(s.eventType, s.cadence)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      class="btn btn-action btn-remove"
                      onClick={() => handleRemoveSchedule(s.eventType)}
                      title="Remove schedule"
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {addingSchedule ? (
            <div class="schedule-add-form">
              <select
                value={newSchedType}
                onChange={(e) => setNewSchedType(e.target.value)}
                class="form-select"
              >
                <option value="">Select type</option>
                {availableEventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Days"
                value={newSchedCadence}
                onChange={(e) => setNewSchedCadence(e.target.value)}
                class="form-input form-input-short"
              />
              <button
                class="btn btn-small btn-save"
                onClick={handleAddSchedule}
                disabled={!newSchedType || !newSchedCadence}
              >
                Add
              </button>
              <button class="btn btn-small" onClick={() => setAddingSchedule(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              class="btn btn-small btn-add-schedule-inline"
              onClick={() => setAddingSchedule(true)}
            >
              + Add Schedule
            </button>
          )}
        </section>
      )}

      {(!plantSchedules || plantSchedules.length === 0) && (
        <section class="detail-section">
          <h3>Care Schedule</h3>
          <p class="empty-schedule">No schedules yet.</p>
          {addingSchedule ? (
            <div class="schedule-add-form">
              <select
                value={newSchedType}
                onChange={(e) => setNewSchedType(e.target.value)}
                class="form-select"
              >
                <option value="">Select type</option>
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
                value={newSchedCadence}
                onChange={(e) => setNewSchedCadence(e.target.value)}
                class="form-input form-input-short"
              />
              <button
                class="btn btn-small btn-save"
                onClick={handleAddSchedule}
                disabled={!newSchedType || !newSchedCadence}
              >
                Add
              </button>
              <button class="btn btn-small" onClick={() => setAddingSchedule(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              class="btn btn-small btn-add-schedule-inline"
              onClick={() => setAddingSchedule(true)}
            >
              + Add Schedule
            </button>
          )}
        </section>
      )}

      {speciesInfo && (
        <section class="detail-section">
          <h3>Species Care Guide</h3>
          {speciesInfo.scientificName && (
            <p class="scientific-name">
              <em>{speciesInfo.scientificName}</em>
              {speciesInfo.family && ` — ${speciesInfo.family}`}
            </p>
          )}
          {speciesInfo.light && <CareItem label="Light" value={speciesInfo.light} />}
          {speciesInfo.water && <CareItem label="Water" value={speciesInfo.water} />}
          {speciesInfo.humidity && <CareItem label="Humidity" value={speciesInfo.humidity} />}
          {speciesInfo.temperature && <CareItem label="Temperature" value={speciesInfo.temperature} />}
          {speciesInfo.food && <CareItem label="Food" value={speciesInfo.food} />}
          {speciesInfo.toxicity && <CareItem label="Toxicity" value={speciesInfo.toxicity} />}
          {speciesInfo.petFriendly && <CareItem label="Pet Friendly" value={speciesInfo.petFriendly} />}
          {speciesInfo.additionalCare && <CareItem label="Additional Care" value={speciesInfo.additionalCare} />}
          {speciesInfo.commonIssues && <CareItem label="Common Issues" value={speciesInfo.commonIssues} />}
        </section>
      )}

      <section class="detail-section danger-zone">
        {showConfirmRemove ? (
          <div class="confirm-remove">
            <p>Remove <strong>{plant.name}</strong> and all its schedules?</p>
            <div class="confirm-actions">
              <button class="btn btn-danger" onClick={handleRemove}>
                Yes, Remove
              </button>
              <button class="btn btn-small" onClick={() => setShowConfirmRemove(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            class="btn btn-danger-outline"
            onClick={() => setShowConfirmRemove(true)}
          >
            Remove Plant
          </button>
        )}
      </section>
    </main>
  );
}

function CareItem({ label, value }) {
  if (label === 'Common Issues') {
    const issues = value.split('||').map((s) => s.trim()).filter(Boolean);
    return (
      <div class="care-item">
        <strong>{label}:</strong>
        {issues.map((issue, i) => {
          const [title, ...rest] = issue.split(':');
          const body = rest.join(':').trim();
          return (
            <details key={i} class="care-issue">
              <summary>{title.trim()}</summary>
              {body && <p>{body.split('|').map((para, j) => (
                <span key={j}>{para.trim()}<br /><br /></span>
              ))}</p>}
            </details>
          );
        })}
      </div>
    );
  }

  const paragraphs = value.split('|').map((s) => s.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    return (
      <div class="care-item">
        <strong>{label}:</strong> {value}
      </div>
    );
  }

  return (
    <div class="care-item">
      <strong>{label}:</strong>
      {paragraphs.map((p, i) => (
        <p key={i} class="care-paragraph">{p}</p>
      ))}
    </div>
  );
}
