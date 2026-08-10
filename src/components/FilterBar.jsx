export function FilterBar({
  eventTypes,
  locations,
  filterType,
  filterLocation,
  filterCaretaker,
  sortBy,
  onTypeChange,
  onLocationChange,
  onCaretakerChange,
  onSortChange,
}) {
  return (
    <div class="filter-bar">
      <select value={filterCaretaker} onChange={(e) => onCaretakerChange(e.target.value)}>
        <option value="mine">My Plants</option>
        <option value="all">All Plants</option>
      </select>
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
      <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
        <option value="urgency">Needs Attention</option>
        <option value="name">Plant Name</option>
        <option value="location">Location</option>
        <option value="acquired">Acquired Date</option>
      </select>
    </div>
  );
}
