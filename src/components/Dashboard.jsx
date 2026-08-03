import { useState, useEffect } from 'preact/hooks';
import { PlantCard } from './PlantCard.jsx';
import { FilterBar } from './FilterBar.jsx';

export function Dashboard({
  data,
  caretaker,
  onSelectPlant,
  onAction,
  onAddPlant,
  filterType,
  filterLocation,
  search,
  onFilterTypeChange,
  onFilterLocationChange,
  onSearchChange,
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (data.isLoading) {
    return <div class="loading">Loading plant data...</div>;
  }

  const locations = [...new Set(data.inventory.map((p) => p.location).filter(Boolean))].sort();
  const searchLower = search.toLowerCase().trim();

  // Compute last watered date per plant (by ID)
  const lastWateredMap = new Map();
  for (const event of (data.events || [])) {
    if (event.eventType === 'Water' && event.outcome === 'Done') {
      const existing = lastWateredMap.get(event.plantId);
      const ts = new Date(event.timestamp);
      if (!existing || ts > existing) {
        lastWateredMap.set(event.plantId, ts);
      }
    }
  }
  const formatLastWatered = (plantId) => {
    const d = lastWateredMap.get(plantId);
    if (!d) return null;
    const days = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  };

  let plants = data.plantsByUrgency || [];

  if (filterType !== 'all') {
    plants = plants
      .map((entry) => ({
        ...entry,
        schedules: entry.schedules.filter((s) => s.eventType === filterType),
      }))
      .filter((entry) => entry.schedules.length > 0);
  }

  if (filterLocation !== 'all') {
    plants = plants.filter((entry) => entry.plant.location === filterLocation);
  }

  if (searchLower) {
    plants = plants.filter((entry) =>
      entry.plant.name.toLowerCase().includes(searchLower) ||
      (entry.plant.location || '').toLowerCase().includes(searchLower) ||
      (entry.plant.species || '').toLowerCase().includes(searchLower)
    );
  }

  const needsAttention = plants.filter((p) => p.maxOverdue >= 0);
  const upcoming = plants.filter((p) => p.maxOverdue < 0 && p.maxOverdue > -Infinity);

  // Plants with no schedule at all
  const scheduledPlantIds = new Set((data.schedules || []).map((s) => s.plantId));
  let unscheduled = (data.inventory || []).filter((p) => !scheduledPlantIds.has(p.id));
  if (filterLocation !== 'all') {
    unscheduled = unscheduled.filter((p) => p.location === filterLocation);
  }
  if (searchLower) {
    unscheduled = unscheduled.filter((p) =>
      p.name.toLowerCase().includes(searchLower) ||
      (p.location || '').toLowerCase().includes(searchLower) ||
      (p.species || '').toLowerCase().includes(searchLower)
    );
  }

  return (
    <main class="dashboard">
      <div class="search-bar">
        <input
          type="search"
          class="search-input"
          placeholder="Search plants..."
          value={search}
          onInput={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <FilterBar
        eventTypes={data.eventTypes}
        locations={locations}
        filterType={filterType}
        filterLocation={filterLocation}
        onTypeChange={onFilterTypeChange}
        onLocationChange={onFilterLocationChange}
      />

      {needsAttention.length > 0 && (
        <section>
          <h2 class="section-title">Needs Attention ({needsAttention.length})</h2>
          {needsAttention.map((entry) => (
            <PlantCard
              key={entry.plant.id}
              entry={entry}
              onSelect={() => onSelectPlant({ ...entry.plant, _dueEventType: entry._dueEventType })}
              onAction={onAction}
              lastWatered={formatLastWatered(entry.plant.id)}
            />
          ))}
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 class="section-title">Upcoming</h2>
          {upcoming.map((entry) => (
            <PlantCard
              key={entry.plant.id}
              entry={entry}
              onSelect={() => onSelectPlant({ ...entry.plant, _dueEventType: entry._dueEventType })}
              onAction={onAction}
              lastWatered={formatLastWatered(entry.plant.id)}
            />
          ))}
        </section>
      )}

      {unscheduled.length > 0 && filterType === 'all' && (
        <section>
          <h2 class="section-title">No Schedule ({unscheduled.length})</h2>
          {unscheduled.map((plant) => (
            <div
              key={plant.id}
              class="plant-card urgency-none"
              onClick={() => onSelectPlant(plant)}
            >
              <div class="plant-card-info">
                <div class="plant-card-name">{plant.name}</div>
                <div class="plant-card-meta">
                  {plant.location && <span class="location-tag">{plant.location}</span>}
                  {formatLastWatered(plant.id) && (
                    <span class="last-watered-tag">💧 {formatLastWatered(plant.id)}</span>
                  )}
                </div>
                <div class="plant-card-due">No care schedule set</div>
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
              </div>
            </div>
          ))}
        </section>
      )}

      {plants.length === 0 && unscheduled.length === 0 && (
        <p class="empty-state">No plants match your filters.</p>
      )}

      <div class="fab-container">
        <button class="btn btn-fab" onClick={onAddPlant} title="Add plant">
          +
        </button>
      </div>

      {showBackToTop && (
        <button
          class="btn btn-back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to top"
        >
          ↑
        </button>
      )}
    </main>
  );
}
