import { getPhotoThumbUrl } from '../services/drive.js';

export function PlantCard({ entry, onSelect, onAction, lastWatered, showImages }) {
  const { plant, schedules, maxOverdue, _dueEventType } = entry;

  const urgencyClass =
    maxOverdue === Infinity
      ? 'urgency-immediate'
      : maxOverdue > 0
        ? 'urgency-overdue'
        : maxOverdue === 0
          ? 'urgency-today'
          : 'urgency-upcoming';

  const urgencyLabel =
    maxOverdue === Infinity
      ? 'Never done'
      : maxOverdue > 0
        ? `${maxOverdue}d overdue`
        : maxOverdue === 0
          ? 'Due today'
          : `In ${Math.abs(maxOverdue)}d`;

  const dueTypes = schedules
    .filter((s) => s.daysOverdue >= 0)
    .map((s) => s.eventType);

  const hasSchedule = schedules && schedules.length > 0;

  const thumbUrl = showImages && plant.photo ? getPhotoThumbUrl(plant.photo) : null;

  return (
    <div class={`plant-card ${urgencyClass}`} onClick={onSelect}>
      {thumbUrl && <img src={thumbUrl} alt="" class="plant-card-thumb" loading="lazy" onError={(e) => e.target.style.display='none'} />}
      <div class="plant-card-info">
        <div class="plant-card-name">{plant.name}</div>
        <div class="plant-card-meta">
          {plant.location && <span class="location-tag">{plant.location}</span>}
          {lastWatered && <span class="last-watered-tag">💧 {lastWatered}</span>}
        </div>
        <div class="plant-card-due">
          {dueTypes.length > 0
            ? dueTypes.join(', ')
            : _dueEventType || schedules[0]?.eventType || ''}
          {(dueTypes.length > 0 || _dueEventType || schedules[0]?.eventType) && ' — '}
          <span class="urgency-label">{urgencyLabel}</span>
        </div>
      </div>
      <div class="plant-card-actions-container" onClick={(e) => e.stopPropagation()}>
        <div class="plant-card-actions">
          <button
            class="btn btn-action btn-quick-water"
            onClick={() => onAction(plant.id, 'Water', 'Done')}
            title="Water"
          >
            💧
          </button>
          <button
            class="btn btn-action btn-quick-fertilize"
            onClick={() => onAction(plant.id, 'Fertilize', 'Done')}
            title="Fertilize"
          >
            🌿
          </button>
          <button
            class="btn btn-action btn-quick-repot"
            onClick={() => onAction(plant.id, 'Repot', 'Done')}
            title="Repot"
          >
            🪴
          </button>
        </div>
        {hasSchedule && (
          <div class="plant-card-actions plant-card-actions-secondary">
            <button
              class="btn btn-action btn-snooze"
              onClick={() => onAction(plant.id, _dueEventType || schedules[0]?.eventType, 'Snoozed')}
              title="Snooze 2 days"
            >
              ⏰
            </button>
            <button
              class="btn btn-action btn-skip"
              onClick={() => onAction(plant.id, _dueEventType || schedules[0]?.eventType, 'Skipped')}
              title="Skip"
            >
              ⏭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
