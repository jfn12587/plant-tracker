import { useState } from 'preact/hooks';

export function Header({ user, onSignOut, syncStatus, syncError, showImages, onToggleImages }) {
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  return (
    <header class="app-header">
      <h1>🌱 Plant Tracker</h1>
      <div class="header-right">
        {syncStatus === 'syncing' && <span class="sync-badge">Syncing...</span>}
        {syncStatus === 'error' && (
          <span
            class="sync-badge error"
            onClick={() => setShowErrorDetail(true)}
            style="cursor: pointer;"
          >
            Sync error
          </span>
        )}
        <button
          class={`btn btn-small btn-toggle-images ${showImages ? 'active' : ''}`}
          onClick={onToggleImages}
          title={showImages ? 'Small thumbnails' : 'Large images'}
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

      {showErrorDetail && syncError && (
        <div class="error-overlay" onClick={() => setShowErrorDetail(false)}>
          <div class="error-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sync Error</h3>
            <div class="error-detail">
              <p><strong>Operation:</strong> {syncError.operation}</p>
              <p><strong>Time:</strong> {syncError.time}</p>
              <p><strong>Message:</strong> {syncError.message}</p>
              {syncError.stack && (
                <pre class="error-stack">{syncError.stack}</pre>
              )}
            </div>
            <button class="btn btn-small" onClick={() => setShowErrorDetail(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
