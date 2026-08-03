export function FilterBar({
  eventTypes,
  locations,
  filterType,
  filterLocation,
  onTypeChange,
  onLocationChange,
}) {
  return (
    <div class="filter-bar">
      <select value={filterType} onChange={(e) => onTypeChange(e.target.value)}>
        <option value="all">All types</option>
        {eventTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select value={filterLocation} onChange={(e) => onLocationChange(e.target.value)}>
        <option value="all">All locations</option>
        {locations.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
