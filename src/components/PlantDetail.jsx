import { useState } from 'preact/hooks';
import { getPhotoUrl } from '../services/drive.js';
import { PhotoCapture } from './PhotoCapture.jsx';

export function PlantDetail({ plant, data, onBack, onAction, onRemove, onPropagate, showImages }) {
  // Always look up the current plant from data so we get fresh photo/name/etc.
  const currentPlant = data.inventory?.find((p) => p.id === plant.id) || plant;

  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editCadence, setEditCadence] = useState('');
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newSchedType, setNewSchedType] = useState('');
  const [newSchedCadence, setNewSchedCadence] = useState('');
  const [loggingEvent, setLoggingEvent] = useState(false);
  const [adHocType, setAdHocType] = useState('');
  const [adHocDate, setAdHocDate] = useState('');
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // index in plantEvents
  const [editEventType, setEditEventType] = useState('');
  const [editEventOutcome, setEditEventOutcome] = useState('');

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(currentPlant.name || '');
  const [editLocation, setEditLocation] = useState(currentPlant.location || '');
  const [editCaretaker, setEditCaretaker] = useState(currentPlant.caretaker || '');
  const [editPot, setEditPot] = useState(currentPlant.pot || '');
  const [editNotes, setEditNotes] = useState(currentPlant.notes || '');
  const [editLight, setEditLight] = useState(currentPlant.light || '');
  const [editWater, setEditWater] = useState(currentPlant.water || '');
  const [editHumidity, setEditHumidity] = useState(currentPlant.humidity || '');
  const [editFertilizing, setEditFertilizing] = useState(currentPlant.fertilizing || '');
  const [saving, setSaving] = useState(false);

  const speciesInfo = data.species?.find(
    (s) => s.name === currentPlant.species || s.name === currentPlant.name
  );

  const plantSchedules = data.scheduleStatuses?.filter(
    (s) => s.plantId === currentPlant.id
  );

  // All events for this plant, grouped by event type with last-done date
  const plantEvents = (data.events || []).filter((e) => e.plantId === currentPlant.id);
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

  const photoUrl = currentPlant.photo ? getPhotoUrl(currentPlant.photo) : null;

  const handleLogAdHocEvent = async () => {
    if (!adHocType) return;
    const ts = adHocDate ? new Date(adHocDate + 'T12:00:00').toISOString() : undefined;
    await data.logEvent(currentPlant.id, adHocType, 'Done', ts);
    setAdHocType('');
    setAdHocDate('');
    setLoggingEvent(false);
  };

  const handlePhotoUpload = async (file) => {
    await data.uploadPlantPhoto(currentPlant.id, file);
  };

  const handleRemove = async () => {
    await onRemove(currentPlant.id);
  };

  const handleDeleteEvent = async (eventIndex) => {
    await data.deleteEvent(currentPlant.id, eventIndex);
  };

  const handleStartEditEvent = (eventIndex) => {
    const event = plantEvents[eventIndex];
    setEditingEvent(eventIndex);
    setEditEventType(event.eventType);
    setEditEventOutcome(event.outcome);
  };

  const handleSaveEditEvent = async () => {
    if (editingEvent === null) return;
    const event = plantEvents[editingEvent];
    await data.updateEvent(currentPlant.id, editingEvent, {
      eventType: editEventType,
      outcome: editEventOutcome,
    });
    setEditingEvent(null);
    setEditEventType('');
    setEditEventOutcome('');
  };

  const handleEditSchedule = (eventType, cadence) => {
    setEditingSchedule(eventType);
    setEditCadence(String(cadence));
  };

  const handleSaveSchedule = async () => {
    if (!editCadence) return;
    await data.updateSchedule(currentPlant.id, editingSchedule, parseInt(editCadence, 10));
    setEditingSchedule(null);
    setEditCadence('');
  };

  const handleRemoveSchedule = async (eventType) => {
    await data.removeSchedule(currentPlant.id, eventType);
  };

  const handleAddSchedule = async () => {
    if (!newSchedType || !newSchedCadence) return;
    await data.addSchedule(currentPlant.id, parseInt(newSchedCadence, 10), newSchedType);
    setNewSchedType('');
    setNewSchedCadence('');
    setAddingSchedule(false);
  };

  const handleStartEdit = () => {
    setEditName(currentPlant.name || '');
    setEditLocation(currentPlant.location || '');
    setEditCaretaker(currentPlant.caretaker || '');
    setEditPot(currentPlant.pot || '');
    setEditNotes(currentPlant.notes || '');
    setEditLight(currentPlant.light || '');
    setEditWater(currentPlant.water || '');
    setEditHumidity(currentPlant.humidity || '');
    setEditFertilizing(currentPlant.fertilizing || '');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await data.updatePlant(currentPlant.id, {
        name: editName.trim(),
        location: editLocation.trim(),
        caretaker: editCaretaker.trim(),
        pot: editPot.trim(),
        notes: editNotes.trim(),
        light: editLight.trim(),
        water: editWater.trim(),
        humidity: editHumidity.trim(),
        fertilizing: editFertilizing.trim(),
      });
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
          <img src={photoUrl} alt={currentPlant.name} class="plant-photo" />
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
        <h2>{currentPlant.name}</h2>
      )}
      {currentPlant.species && <p class="species-name">{currentPlant.species}</p>}

      <div class="detail-actions-bar">
        {!editing && (
          <button class="btn btn-small btn-edit-plant" onClick={handleStartEdit}>
            Edit
          </button>
        )}
        {onPropagate && !editing && (
          <button class="btn btn-small btn-propagate" onClick={() => onPropagate(currentPlant)}>
            Propagate
          </button>
        )}
      </div>

      <div class="quick-actions">
        <button class="btn btn-quick btn-quick-water" onClick={() => data.logEvent(currentPlant.id, 'Water', 'Done')}>
          💧 Water
        </button>
        <button class="btn btn-quick btn-quick-fertilize" onClick={() => data.logEvent(currentPlant.id, 'Fertilize', 'Done')}>
          🌿 Fertilize
        </button>
        <button class="btn btn-quick btn-quick-repot" onClick={() => data.logEvent(currentPlant.id, 'Repot', 'Done')}>
          🪴 Repot
        </button>
      </div>

      {(!currentPlant.photo || editing) && (
        <div class="photo-section">
          <PhotoCapture onUpload={handlePhotoUpload} />
        </div>
      )}

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
            {currentPlant.acquiredDate && (
              <div class="detail-item">
                <label>Acquired</label>
                <span>{currentPlant.acquiredDate}</span>
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
            <div class="detail-item full-width">
              <label class="form-label">Light</label>
              <textarea
                class="form-textarea"
                value={editLight}
                onChange={(e) => setEditLight(e.target.value)}
                rows="2"
              />
            </div>
            <div class="detail-item full-width">
              <label class="form-label">Water</label>
              <textarea
                class="form-textarea"
                value={editWater}
                onChange={(e) => setEditWater(e.target.value)}
                rows="2"
              />
            </div>
            <div class="detail-item full-width">
              <label class="form-label">Humidity</label>
              <textarea
                class="form-textarea"
                value={editHumidity}
                onChange={(e) => setEditHumidity(e.target.value)}
                rows="2"
              />
            </div>
            <div class="detail-item full-width">
              <label class="form-label">Fertilizing</label>
              <textarea
                class="form-textarea"
                value={editFertilizing}
                onChange={(e) => setEditFertilizing(e.target.value)}
                rows="2"
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
            {currentPlant.location && (
              <div class="detail-item">
                <label>Location</label>
                <span>{currentPlant.location}</span>
              </div>
            )}
            {currentPlant.caretaker && (
              <div class="detail-item">
                <label>Caretaker</label>
                <span>{currentPlant.caretaker}</span>
              </div>
            )}
            {currentPlant.acquiredDate && (
              <div class="detail-item">
                <label>Acquired</label>
                <span>{currentPlant.acquiredDate}</span>
              </div>
            )}
            {currentPlant.pot && (
              <div class="detail-item">
                <label>Pot</label>
                <span>{currentPlant.pot}</span>
              </div>
            )}
            {currentPlant.notes && (
              <div class="detail-item full-width">
                <label>Notes</label>
                <MultilineText text={currentPlant.notes} />
              </div>
            )}
            {currentPlant.light && (
              <div class="detail-item full-width">
                <label>Light</label>
                <MultilineText text={currentPlant.light} />
              </div>
            )}
            {currentPlant.water && (
              <div class="detail-item full-width">
                <label>Water</label>
                <MultilineText text={currentPlant.water} />
              </div>
            )}
            {currentPlant.humidity && (
              <div class="detail-item full-width">
                <label>Humidity</label>
                <MultilineText text={currentPlant.humidity} />
              </div>
            )}
            {currentPlant.fertilizing && (
              <div class="detail-item full-width">
                <label>Fertilizing</label>
                <MultilineText text={currentPlant.fertilizing} />
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

        {plantEvents.length > 0 && (
          <button
            class="btn btn-small btn-show-all-events"
            onClick={() => setShowAllEvents(!showAllEvents)}
          >
            {showAllEvents ? 'Hide All' : 'Show All'}
          </button>
        )}

        {showAllEvents && (
          <div class="event-table-container">
            <table class="event-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Outcome</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...plantEvents].reverse().map((event, reverseIdx) => {
                  const eventIndex = plantEvents.length - 1 - reverseIdx;
                  return (
                    <tr key={reverseIdx}>
                      {editingEvent === eventIndex ? (
                        <>
                          <td>{new Date(event.timestamp).toLocaleString()}</td>
                          <td>
                            <select
                              class="form-select form-select-compact"
                              value={editEventType}
                              onChange={(e) => setEditEventType(e.target.value)}
                            >
                              {(data.eventTypes || []).map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              class="form-select form-select-compact"
                              value={editEventOutcome}
                              onChange={(e) => setEditEventOutcome(e.target.value)}
                            >
                              <option value="Done">Done</option>
                              <option value="Snoozed">Snoozed</option>
                              <option value="Skipped">Skipped</option>
                            </select>
                          </td>
                          <td>
                            <button class="btn btn-small btn-save" onClick={handleSaveEditEvent}>Save</button>
                            <button class="btn btn-small" onClick={() => setEditingEvent(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{new Date(event.timestamp).toLocaleString()}</td>
                          <td>{event.eventType}</td>
                          <td>{event.outcome}</td>
                          <td>
                            <button
                              class="btn btn-action btn-edit"
                              onClick={() => handleStartEditEvent(eventIndex)}
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              class="btn btn-action btn-remove"
                              onClick={() => handleDeleteEvent(eventIndex)}
                              title="Delete"
                            >
                              ✕
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                    <button class="btn btn-action btn-done" onClick={() => data.logEvent(currentPlant.id, s.eventType, 'Done')}>
                      ✓
                    </button>
                    <button class="btn btn-action btn-snooze" onClick={() => data.logEvent(currentPlant.id, s.eventType, 'Snoozed')}>
                      ⏰
                    </button>
                    <button class="btn btn-action btn-skip" onClick={() => data.logEvent(currentPlant.id, s.eventType, 'Skipped')}>
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
            <p>Remove <strong>{currentPlant.name}</strong> and all its schedules?</p>
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

function MultilineText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  if (lines.length <= 1) {
    return <span>{text}</span>;
  }
  return (
    <span class="multiline-text">
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </span>
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
