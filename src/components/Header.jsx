export function Header({ user, onSignOut, syncStatus, showImages, onToggleImages }) {
  return (
    <header class="app-header">
      <h1>🌱 Plant Tracker</h1>
      <div class="header-right">
        {syncStatus === 'syncing' && <span class="sync-badge">Syncing...</span>}
        {syncStatus === 'error' && <span class="sync-badge error">Sync error</span>}
        <button
          class={`btn btn-small btn-toggle-images ${showImages ? 'active' : ''}`}
          onClick={onToggleImages}
          title={showImages ? 'Hide images' : 'Show images'}
        >
          {showImages ? '🖼' : '🖼̸'}
        </button>
        {user && (
          <div class="user-info">
            <img src={user.picture} alt="" class="avatar" />
            <button class="btn btn-small" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
