# Plant Tracker PWA - System Specification

## 1. Architecture Overview

```
+-------------------+          +-------------------------+
|                   |          |    Google Cloud APIs     |
|   Preact PWA      |  HTTPS   |                         |
|   (Browser)       +--------->| Google Sheets API v4    |
|                   |          | Google Drive API v3      |
|   - Components    |          | Google Identity Services |
|   - Schedule Eng. |          | UserInfo endpoint       |
|   - localStorage  |          |                         |
+-------------------+          +-------------------------+
        |
        v
  localStorage (auth + data cache)
```

**Key architectural decisions:**
- No backend server — the browser communicates directly with Google APIs
- Google Sheets serves as both database and admin interface (data is viewable/editable in the spreadsheet UI)
- Google Drive provides photo storage with public thumbnail URLs
- Authentication uses the authorization code flow via Google Identity Services (GIS) code client with a refresh token for persistent sessions
- Refresh token stored in localStorage for persistent login; access tokens kept in memory only and auto-refreshed before expiry
- Local state management via Preact hooks (no external state library)
- Plants identified by unique ID (P001, P002, ...) rather than name, enabling renames without breaking references

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | Preact | ^10.19.0 |
| Build Tool | Vite | ^5.4.0 |
| Vite Plugin | @preact/preset-vite | ^2.8.0 |
| Styling | Vanilla CSS (custom properties) | — |
| Auth | Google Identity Services (GIS) — authorization code flow | Loaded from CDN |
| Data | Google Sheets API | v4 |
| Storage | Google Drive API | v3 |
| Cache | localStorage | Web API |
| Auth Persistence | localStorage (refresh token) | Web API |
| Language | JavaScript (ES modules) | — |
| Package Manager | npm | — |
| Hosting | GitHub Pages | — |
| CI/CD | GitHub Actions | — |

**CDN Dependencies (loaded in index.html):**
- `https://accounts.google.com/gsi/client` — Google Identity Services
- `https://apis.google.com/js/api.js` — Google API loader

## 3. Project Structure

```
vera-pwa/
├── index.html                      Entry point; loads GIS + GAPI scripts, mounts #app
├── package.json                    Dependencies: preact, vite, @preact/preset-vite
├── package-lock.json               Lockfile
├── vite.config.js                  Vite config with preact plugin, base path, port 5173
├── scripts/
│   └── backfill-care-fields.py     Matches plants to species data; outputs TSV for columns J-M
├── public/
│   ├── manifest.json               PWA manifest (name, icons, display mode, theme color)
│   ├── sw.js                       Service worker for installability
│   └── icons/
│       ├── icon-192.png            PWA icon 192x192
│       └── icon-512.png            PWA icon 512x512
├── .github/
│   └── workflows/
│       └── deploy.yml              GitHub Actions: build + deploy to GitHub Pages
├── dist/                           Production build output
│   ├── index.html
│   └── assets/
│       ├── index-*.js              Bundled JS
│       └── index-*.css             Bundled CSS
├── docs/
│   ├── PRODUCT_SPEC.md             Product specification
│   └── SYSTEM_SPEC.md             System specification (this file)
└── src/
    ├── main.jsx                    Renders <App /> into #app, registers service worker
    ├── app.jsx                     Root component; routing, auth gate, view state, filter persistence
    ├── config.js                   OAuth client ID + secret, spreadsheet ID, scopes, caretaker map
    ├── components/
    │   ├── Header.jsx              Sticky header: title, sync badge, image toggle, user avatar, sign out
    │   ├── Dashboard.jsx           Main view: search bar, filter bar, sort modes, plant cards, FAB
    │   ├── PlantCard.jsx           Single plant card: urgency indicator, photo, quick actions, snooze/skip
    │   ├── FilterBar.jsx           Dropdowns for event type, location, and sort mode
    │   ├── PlantDetail.jsx         Full plant info: edit mode, schedules, activity, species guide, propagate
    │   ├── AddPlantForm.jsx        Two-step form: plant metadata then schedule setup
    │   ├── PhotoCapture.jsx        File input with camera capture, delegates to CropOverlay
    │   ├── CropOverlay.jsx         Full-screen crop UI with drag/pinch-to-zoom and square frame
    │   └── MultilineText.jsx       Renders text with preserved newlines (white-space: pre-wrap)
    ├── hooks/
    │   ├── useGoogleAuth.js        GIS code client, auth code exchange, refresh token persistence, auto-refresh
    │   └── useSheetsData.js        Data fetching, CRUD operations, optimistic updates, computed state
    ├── services/
    │   ├── sheets.js               Google Sheets API wrapper (batchGet, append, update, delete)
    │   ├── drive.js                Google Drive upload, public sharing, thumbnail URL helper
    │   └── cache.js                localStorage get/set with versioning
    ├── utils/
    │   └── scheduleEngine.js       Schedule status computation, plant grouping/sorting
    └── styles/
        └── global.css              All application styles (CSS custom properties, mobile-first)
```

## 4. Authentication

### 4.1 Flow

1. **On Mount** (`useGoogleAuth.js`): Checks localStorage for an existing refresh token (`vera-pwa-refresh-token`). If found, exchanges it for a fresh access token via Google's token endpoint. UI shows "Signing in..." during this process. If the refresh fails (token revoked), clears storage and shows the login button.
2. **Sign In**: Uses `google.accounts.oauth2.initCodeClient()` (authorization code flow) with:
   - `client_id`: `988681646813-lh48egqaqajdapkm1mpjlimbba5pi2au.apps.googleusercontent.com`
   - `scope`: `openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file`
   - `ux_mode`: `'popup'`
   - `callback`: Receives an authorization code
3. **Code Exchange**: POSTs the authorization code to `https://oauth2.googleapis.com/token` with `client_id`, `client_secret`, `redirect_uri: 'postmessage'`, and `grant_type: 'authorization_code'`. Returns `access_token`, `refresh_token`, and `expires_in`.
4. **Token Storage**: The refresh token is stored in localStorage for persistent sessions. The access token is kept in memory only (not persisted).
5. **Auto-Refresh**: A timer is set to refresh the access token 60 seconds before it expires. On refresh, POSTs to the token endpoint with `grant_type: 'refresh_token'`. The timer is cleared on component unmount.
6. **User Info**: After obtaining an access token (initial or refreshed), fetches `https://www.googleapis.com/oauth2/v3/userinfo` to get email, name, and profile picture. Stores user info in localStorage for immediate display on next load.
7. **Sign Out**: Revokes the refresh token via `https://oauth2.googleapis.com/revoke`, clears all localStorage entries, timers, and local state.

### 4.2 Auth Storage Keys (localStorage)

| Key | Value | Purpose |
|-----|-------|---------|
| `vera-pwa-refresh-token` | OAuth2 refresh token string | Persistent login across sessions (exchanged for access tokens) |
| `vera-pwa-user` | JSON `{ email, name, picture }` | Display user info immediately while token refresh is in progress |

Note: Access tokens are transient (in-memory only) and auto-refreshed before expiry. The old `vera-pwa-token` key is no longer used and is cleaned up on sign-out.

### 4.3 Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `email` | Read user's email address |
| `profile` | Read user's name and profile picture |
| `https://www.googleapis.com/auth/spreadsheets` | Full read/write access to Google Sheets |
| `https://www.googleapis.com/auth/drive.file` | Access to files created by this app in Drive |

### 4.4 Caretaker Mapping

The `CONFIG.CARETAKER_MAP` object maps email addresses to display names:

```javascript
{
  'josh@nedelka.com': 'Josh',
  'jfn12587@gmail.com': 'Josh',
  'drflaherty89@gmail.com': 'Deanna',
}
```

Resolution: `user.email in CARETAKER_MAP ? CARETAKER_MAP[email] : user.name`

The resolved `caretaker` string is passed to the Dashboard component for potential filtering.

## 5. Data Layer

### 5.1 Sheets Service (`src/services/sheets.js`)

All operations use the Google Sheets API v4 REST endpoints. Base URL:
```
https://sheets.googleapis.com/v4/spreadsheets/16KzR3l0V6-aQe7Lus5eEsnR8Y0ncoW7YGshReJtjhkY
```

#### Functions

| Function | HTTP Method | Endpoint | Purpose |
|----------|-------------|----------|---------|
| `fetchAllData(token)` | GET | `/values:batchGet?ranges=...` | Fetches all 5 tabs in a single request |
| `appendEvent(token, plantId, eventType, outcome, timestamp)` | POST | `/values/Events!A:D:append` | Appends a new event row |
| `appendRow(token, sheetName, values)` | POST | `/values/{sheet}!A:Z:append` | Generic row append (Inventory, Schedules) |
| `updateCell(token, range, value)` | PUT | `/values/{range}` | Updates a single cell (photo ID) |
| `updateRow(token, range, values)` | PUT | `/values/{range}` | Updates a full row (plant edit, schedule cadence) |
| `getSheetMetadata(token)` | GET | `/?fields=sheets.properties` | Gets tab names and sheet IDs for delete ops |
| `deleteRow(token, sheetTabId, rowIndex)` | POST | `/:batchUpdate` | Deletes a single row by index |
| `deleteRows(token, sheetTabId, rowIndices)` | POST | `/:batchUpdate` | Deletes multiple rows (sorted descending to avoid index shift) |

#### Data Fetching

`fetchAllData` fetches five ranges in a single batchGet call:
- `Inventory!A:M` (13 columns, includes ID and care fields)
- `Events!A:D`
- `Schedules!A:C`
- `Event Types!A:A`
- `Species!A:L`

#### Data Parsing

Raw sheet values are parsed into typed objects by helper functions:
- `parseInventory(rows)` — maps columns A-M to `{ id, name, species, caretaker, location, acquiredDate, photo, pot, notes, light, water, humidity, fertilizing }`
- `parseEvents(rows)` — maps columns A-D to `{ plantId, timestamp, eventType, outcome }`
- `parseSchedules(rows)` — maps columns A-C to `{ plantId, cadence (int), eventType }`
- `parseEventTypes(rows)` — extracts column A as a flat string array
- `parseSpecies(rows)` — maps columns A-L to `{ name, scientificName, family, light, water, humidity, temperature, food, toxicity, petFriendly, additionalCare, commonIssues }`

All parsers skip the header row (index 0).

### 5.2 Cache Strategy (`src/services/cache.js`)

```javascript
// Cache structure in localStorage
{
  version: 1,               // Allows cache invalidation on schema change
  timestamp: Date.now(),    // When data was last fetched
  data: {                   // Full fetchAllData() response
    inventory: [...],
    events: [...],
    schedules: [...],
    eventTypes: [...],
    species: [...]
  }
}
```

- **Key**: `vera-pwa-data`
- **Read**: On component mount, before network fetch
- **Write**: After every successful `fetchAllData()`
- **Invalidation**: If stored `version !== CACHE_VERSION`, cache is treated as missing
- **Failure**: Silently catches localStorage errors (quota exceeded, private browsing)

### 5.3 Optimistic Updates (`src/hooks/useSheetsData.js`)

Write operations follow this pattern:
1. Update local `raw` state immediately via `setRaw(prev => ...)`
2. Fire the API call asynchronously
3. Set `syncStatus` to `'synced'` on success or `'error'` on failure
4. Do NOT revert optimistic state on failure (user sees error badge)

Operations with optimistic updates:
- `logEvent` — appends to `raw.events` (supports optional timestamp for back-dating)
- `addPlant` — appends to `raw.inventory` with auto-generated ID
- `updatePlant` — maps over `raw.inventory` to update editable fields; writes to `Inventory!A{row}:M{row}`
- `removePlant` — filters from `raw.inventory` and `raw.schedules`
- `addSchedule` — appends to `raw.schedules`
- `updateSchedule` — maps over `raw.schedules`
- `removeSchedule` — filters from `raw.schedules`
- `updatePlantPhoto` — maps over `raw.inventory` to update photo field
- `uploadPlantPhoto` — uploads file to Drive, then calls `updatePlantPhoto`
- `deleteEvent` — finds event by plant-relative index, deletes row from Events sheet, filters from `raw.events`
- `updateEvent` — finds event by plant-relative index, updates row in Events sheet (event type, outcome), maps over `raw.events`

### 5.4 Unique ID Generation

The `nextPlantId()` function in `useSheetsData.js`:
1. Scans all existing inventory items, extracting the numeric portion of each ID
2. Finds the maximum number
3. Returns `P` + zero-padded (3 digits) next number
4. Example: if max existing is P042, next ID is P043
5. If no plants exist, starts at P001

## 6. Schedule Engine

### 6.1 Algorithm (`src/utils/scheduleEngine.js`)

#### `computeScheduleStatus(schedules, events, inventory)`

```
FOR each schedule (plantId, cadence, eventType):
    matchingEvents = events WHERE plantId AND eventType match, sorted DESC by timestamp
    lastDoneEvent = first event in matchingEvents WHERE outcome == "Done"
    lastDone = lastDoneEvent.timestamp or NULL

    IF lastDone is NULL:
        nextDue = NULL
        daysOverdue = Infinity       // Never done = most urgent

    ELSE:
        eventsAfterLastDone = matchingEvents WHERE timestamp > lastDone
        
        IF eventsAfterLastDone is not empty:
            mostRecent = eventsAfterLastDone[0]   // newest
            
            IF mostRecent.outcome == "Snoozed":
                nextDue = mostRecent.timestamp + 2 days
            
            ELSE IF mostRecent.outcome == "Skipped":
                skipCount = COUNT(eventsAfterLastDone WHERE outcome == "Skipped")
                nextDue = lastDone + (cadence * (1 + skipCount))
            
            ELSE:
                nextDue = lastDone + cadence
        
        ELSE:
            nextDue = lastDone + cadence
        
        daysOverdue = floor((today_midnight - nextDue) / one_day)

    RETURN { ...schedule, lastDone, nextDue, daysOverdue, plant: inventory[plantId] }
```

#### `groupByPlant(scheduleStatuses)`

```
FOR each scheduleStatus:
    GROUP by plant.id
    TRACK maxOverdue = max(daysOverdue) across all schedules for this plant
    TRACK _dueEventType = eventType of the schedule with maxOverdue

SORT groups DESCENDING by maxOverdue
RETURN array of { plant, schedules, maxOverdue, _dueEventType }
```

### 6.2 Key Behaviors

| Scenario | nextDue Calculation |
|----------|---------------------|
| Never done | null (daysOverdue = Infinity) |
| Normal cycle | lastDone + cadence |
| Snoozed once | snooze timestamp + 2 days |
| Skipped once | lastDone + (cadence * 2) |
| Skipped twice | lastDone + (cadence * 3) |
| Snoozed then Skipped | Uses most recent action |

## 7. Component Architecture

### 7.1 App (`src/app.jsx`)

**Responsibility:** Root component managing view routing, auth gating, filter state persistence, and connecting auth with data.

**State:**
- `selectedPlant` — currently viewed plant object (or null)
- `view` — one of `'dashboard'`, `'detail'`, `'addPlant'`
- `propagateFrom` — pre-filled values for the Add Plant form when propagating
- `filterType` — event type filter (persists across navigation)
- `filterLocation` — location filter (persists across navigation)
- `search` — search bar text (persists across navigation)
- `sortBy` — sort mode: `'urgency'`, `'name'`, `'location'`, or `'acquired'` (persists across navigation)
- `showImages` — boolean toggle for dashboard thumbnails

**Browser History Integration:**
- Pushes history state on navigation to detail/addPlant views
- Listens for `popstate` event to return to dashboard (Android back button support)
- Scrolls to top on view transitions to detail/addPlant

**Renders:** Conditionally renders login screen, AddPlantForm, PlantDetail, or Dashboard based on auth state and view.

### 7.2 Header (`src/components/Header.jsx`)

**Props:**
- `user: { email, name, picture }` — signed-in user
- `onSignOut: () => void` — sign out handler
- `syncStatus: 'idle' | 'syncing' | 'synced' | 'error'` — current sync state
- `showImages: boolean` — current image toggle state
- `onToggleImages: () => void` — toggle image visibility

**Responsibility:** Sticky top bar with app title, sync status badge, image toggle button, user avatar, and sign-out button.

### 7.3 Dashboard (`src/components/Dashboard.jsx`)

**Props:**
- `data` — full useSheetsData return value
- `caretaker: string` — current user's caretaker name
- `onSelectPlant: (plant) => void` — navigate to detail
- `onAction: (plantId, eventType, outcome) => void` — log an event
- `onAddPlant: () => void` — navigate to add plant form
- `filterType: string` — current event type filter
- `filterLocation: string` — current location filter
- `search: string` — current search text
- `onFilterTypeChange: (value) => void`
- `onFilterLocationChange: (value) => void`
- `onSearchChange: (value) => void`
- `sortBy: string` — current sort mode
- `onSortChange: (value) => void`
- `showImages: boolean` — whether to show thumbnails

**Local State:**
- `showBackToTop` — visibility of the back-to-top button (appears after 400px scroll)

**Responsibility:**
- Renders sticky search bar, filter bar, and sorted/grouped plant cards
- Computes "last watered" for each plant by scanning events
- Splits plants into urgency sections, alphabetical list, or location groups depending on sort mode
- Identifies unscheduled plants (no entries in Schedules) and renders them in a separate section with quick action buttons
- Shows FAB for adding plants and back-to-top button on scroll

### 7.4 PlantCard (`src/components/PlantCard.jsx`)

**Props:**
- `entry: { plant, schedules, maxOverdue, _dueEventType }` — grouped plant data
- `onSelect: () => void` — tap handler for navigation
- `onAction: (plantId, eventType, outcome) => void` — quick action buttons
- `lastWatered: string | null` — formatted "Xd ago" text
- `showImages: boolean` — whether to show thumbnail

**Responsibility:** Single plant card with urgency color coding (immediate/overdue/today/upcoming), thumbnail, name, location, last-watered tag, due info, and two rows of action buttons:
- Row 1: Water/Fertilize/Repot quick actions (always shown)
- Row 2: Snooze/Skip (only shown for plants with schedules)

### 7.5 FilterBar (`src/components/FilterBar.jsx`)

**Props:**
- `eventTypes: string[]` — available event types
- `locations: string[]` — unique locations from inventory
- `filterType: string` — current type filter value
- `filterLocation: string` — current location filter value
- `sortBy: string` — current sort mode
- `onTypeChange: (value) => void`
- `onLocationChange: (value) => void`
- `onSortChange: (value) => void`

**Responsibility:** Three dropdown selects for filtering the dashboard by event type, location, and sort order (Needs Attention / Plant Name / Location / Acquired Date).

### 7.6 PlantDetail (`src/components/PlantDetail.jsx`)

**Props:**
- `plant: { id, name, species, caretaker, location, acquiredDate, photo, pot, notes, _dueEventType }` — plant data
- `data` — full useSheetsData return value
- `onBack: () => void` — return to dashboard
- `onAction: (outcome) => void` — log event for the most urgent schedule
- `onRemove: (plantId) => void` — delete plant
- `onPropagate: (plant) => void` — propagate plant
- `showImages: boolean` — (photo always shown on detail regardless)

**State:**
- `showConfirmRemove` — remove confirmation toggle
- `editingSchedule` / `editCadence` — inline schedule edit state
- `addingSchedule` / `newSchedType` / `newSchedCadence` — new schedule form state
- `loggingEvent` / `adHocType` / `adHocDate` — ad-hoc event logging state with date picker
- `editing` / `editName` / `editLocation` / `editCaretaker` / `editPot` / `editNotes` / `editLight` / `editWater` / `editHumidity` / `editFertilizing` / `saving` — inline plant editing state
- `showAllEvents` — toggles full event history table
- `editingEvent` / `editEventType` / `editEventOutcome` — inline event edit state

**Responsibility:** Full plant information display with all management capabilities:
- Always shows photo if available; file picker hidden when photo exists (shown in edit mode)
- Looks up `currentPlant` from `data.inventory` by ID to always reflect latest state (e.g., after photo upload)
- Edit mode for Name, Location, Caretaker, Pot, Notes, Light, Water, Humidity, Fertilizing fields
- Propagate button to create a derived plant (copies all care fields)
- Quick action buttons (Water/Fertilize/Repot) at the top
- Activity history: all event types with last-done date, cadence, and count
- "Show All" button expands a full event table with inline edit and delete per event
- Ad-hoc event logging with optional back-dating via date picker
- Care schedule management (add/edit/remove schedules, done/snooze/skip actions)
- Species care guide with collapsible common issues
- Plant removal with confirmation dialog

**Helper Component:** `CareItem({ label, value })` — renders species care data with paragraph splitting (`|` delimiter) and collapsible common issues (`||` delimiter between issues).

### 7.7 AddPlantForm (`src/components/AddPlantForm.jsx`)

**Props:**
- `data` — for species list, event types, existing locations
- `onSubmit: (plantData) => Promise<void>` — create plant
- `onAddSchedule: (plantId, cadence, eventType) => Promise<void>` — add schedule
- `onCancel: () => void` — return to dashboard
- `defaultValues: object | null` — pre-filled values for propagation (or null for blank form)

**State:** Form fields (name, species, caretaker, location, acquiredDate, pot, notes, light, water, humidity, fertilizing), submission state, and post-add schedule management (plantAdded, schedules array).

**Responsibility:** Two-phase form — first collects plant metadata (with optional pre-fill from propagation), then (after successful creation) allows adding multiple care schedules. When a species is selected from the datalist, the Light, Water, Humidity, and Fertilizing fields are auto-filled from the matching Species sheet entry.

### 7.8 PhotoCapture (`src/components/PhotoCapture.jsx`)

**Props:**
- `onUpload: (file: Blob) => Promise<void>` — callback with cropped image blob

**State:**
- `uploading` — loading state during upload
- `cropFile` — captured file awaiting crop (null when not cropping)

**Responsibility:** File input with `capture="environment"` for mobile camera. On file selection, opens CropOverlay for user-controlled cropping. After crop confirmation, delegates upload to parent.

### 7.8.1 CropOverlay (`src/components/CropOverlay.jsx`)

**Props:**
- `file: File` — the captured image file to crop
- `onConfirm: (blob: Blob) => void` — called with cropped JPEG blob
- `onCancel: () => void` — discard and close

**State:**
- `offset` — {x, y} pan position of image
- `scale` — zoom level (min = image fills crop frame)
- `imageSize` — natural dimensions of the source image

**Responsibility:** Full-screen overlay with a square crop frame (85vw, centered). User drags to pan and pinches to zoom the image behind the frame. On confirm, calculates the source rectangle in original image coordinates, draws to canvas at max 1200x1200, exports as JPEG at 85% quality. Uses CSS transforms for GPU-accelerated rendering. Handles touch events (single-finger drag, two-finger pinch) and mouse events (drag, scroll wheel zoom).

### 7.9 MultilineText (`src/components/MultilineText.jsx`)

**Props:**
- `text: string` — raw text content (may contain newlines)

**Responsibility:** Renders text with preserved line breaks using `white-space: pre-wrap` styling. Used for Notes and care fields (Light, Water, Humidity, Fertilizing) in PlantDetail so that multiline content entered in the spreadsheet or form is displayed with proper line breaks rather than collapsed into a single line.

## 8. Google Drive Integration

### 8.1 Photo Upload Flow (`src/services/drive.js`)

```
1. User selects/captures image via file input
2. CropOverlay opens:
   - Displays image full-screen with square crop frame
   - User pans (drag) and zooms (pinch/scroll) to frame subject
   - On confirm: calculates source rect, draws to canvas at max 1200x1200, exports JPEG at 0.85
   - On cancel: discards file, returns to detail page
3. drive.uploadPhoto(token, blob, plantName):
   - Generate filename: "{plantName}_{ISO-timestamp}.jpg"
   - Build multipart form:
     - Part 1: JSON metadata { name, mimeType: "image/jpeg" }
     - Part 2: Binary image blob
   - POST to: https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id
   - Returns: Google Drive file ID
4. Set public sharing:
   - POST to: https://www.googleapis.com/drive/v3/files/{fileId}/permissions
   - Body: { role: "reader", type: "anyone" }
   - This makes the thumbnail URL publicly accessible
5. useSheetsData.updatePlantPhoto():
   - Writes file ID to Inventory!G{row} via updateCell
   - Updates local state
```

### 8.2 Photo Display

```javascript
// drive.js: getPhotoUrl(fileId)
`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
```

This URL returns a publicly accessible thumbnail at 800px width. It works because the upload flow adds a public reader permission to each uploaded file.

## 9. PWA Configuration

### 9.1 Manifest (`public/manifest.json`)

```json
{
  "name": "Plant Tracker",
  "short_name": "Plants",
  "description": "Track plant care schedules and log events",
  "start_url": "/plant-tracker/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#5CB947",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ],
  "id": "/plant-tracker/"
}
```

### 9.2 Service Worker

Registered in `src/main.jsx`:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/plant-tracker/sw.js');
}
```

The service worker provides the minimum requirement for PWA installability. The app shell and API responses rely on the localStorage cache for offline read access.

### 9.3 Vite Base Path

`vite.config.js` sets `base: '/plant-tracker/'` so all asset URLs are prefixed correctly for the GitHub Pages subdirectory deployment.

## 10. Deployment

### 10.1 GitHub Actions Workflow (`.github/workflows/deploy.yml`)

- **Trigger**: Push to `master` branch or manual `workflow_dispatch`
- **Permissions**: `contents: read`, `pages: write`, `id-token: write`
- **Concurrency**: Group `pages`, cancel in-progress builds
- **Steps**:
  1. Checkout code
  2. Setup Node 20 with npm cache
  3. `npm ci` (install dependencies)
  4. `npm run build` (Vite production build)
  5. Configure GitHub Pages
  6. Upload `dist/` as Pages artifact
  7. Deploy to GitHub Pages

### 10.2 Production URL

The app is served at `https://<username>.github.io/plant-tracker/` with all assets under the `/plant-tracker/` base path.

## 11. Setup Instructions

### 11.1 Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Plant Tracker")
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API
4. Configure OAuth Consent Screen:
   - User Type: External (or Internal if using Workspace)
   - App name: "Plant Tracker"
   - Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`
   - Add test users if in testing mode
5. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:5173` (dev), plus your production domain (e.g., `https://<username>.github.io`)
   - Authorized redirect URIs: not required (the GIS popup code flow uses `postmessage` as the redirect URI)
6. Copy the Client ID and Client Secret (both are needed for the authorization code flow with refresh tokens)

### 11.2 Google Sheet Setup

1. Create a new Google Spreadsheet
2. Create the following tabs with exact names and column headers:

**Tab: Inventory**
| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | Name | Species | Caretaker | Location | Acquired Date | Photo | Pot | Notes | Light | Water | Humidity | Fertilizing |

**Tab: Events**
| A | B | C | D |
|---|---|---|---|
| Plant ID | Timestamp | Event Type | Outcome |

**Tab: Schedules**
| A | B | C |
|---|---|---|
| Plant ID | Cadence | Event Type |

**Tab: Event Types**
| A |
|---|
| Event Type |
| Water |
| Fertilize |
| Rotate |
| Dust |
| Repot |
| Prune |
| Inspect |

**Tab: Species**
| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Name | Scientific Name | Family | Light | Water | Humidity | Temperature | Food | Toxicity | Pet Friendly | Additional Care | Common Issues |

3. Note the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### 11.3 Species Tab Population

Populate the Species tab with care information for your plants. The following fields support rich text formatting:
- Most text fields: Use `|` as a paragraph separator
- Common Issues: Use `||` to separate different issues; within each issue, format as `Title: description` where description paragraphs are separated by `|`

Example Common Issues value:
```
Root Rot: Caused by overwatering|Allow soil to dry between waterings||Brown Tips: Usually from low humidity|Mist regularly or use a pebble tray
```

### 11.4 Local Development

```bash
# Clone the repository
git clone <repo-url>
cd vera-pwa

# Install dependencies
npm install

# Start development server
npm run dev
# App available at http://localhost:5173/plant-tracker/
```

### 11.5 Environment Configuration

Edit `src/config.js` with your values:

```javascript
export const CONFIG = {
  // OAuth Client ID from GCP Console
  OAUTH_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

  // OAuth Client Secret from GCP Console (required for authorization code flow)
  OAUTH_CLIENT_SECRET: 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx',

  // Spreadsheet ID from the Google Sheet URL
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',

  // OAuth scopes (do not modify unless adding features)
  SCOPES: 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',

  // Map of Google account emails to display names
  CARETAKER_MAP: {
    'user1@gmail.com': 'User 1',
    'user2@gmail.com': 'User 2',
  },
};
```

Note: The client secret is included in the client-side code because this app uses the authorization code flow to obtain refresh tokens for persistent login. This is acceptable for personal-use apps with a limited user base. The OAuth consent screen's "authorized users" list provides the access control.

### 11.6 Production Build and Deployment

```bash
# Build for production
npm run build
# Output in dist/

# Preview production build locally
npm run preview
```

Deployment happens automatically via GitHub Actions on push to `master`. For manual deployment, the `dist/` directory contains a static site compatible with any static hosting provider.

## 12. Scripts

### 12.1 Backfill Care Fields (`scripts/backfill-care-fields.py`)

A one-time utility script that matches existing plants to their species data and generates a TSV suitable for pasting into the Inventory sheet's columns J-M (Light, Water, Humidity, Fertilizing).

**Usage:**
```bash
python3 scripts/backfill-care-fields.py > care_fields.tsv
```

The script reads the spreadsheet data (or exported CSVs), looks up each plant's species in the Species sheet, and outputs a tab-separated file with the care field values to populate for each plant row.

## 13. Future Considerations

- **IndexedDB**: Replace localStorage cache with IndexedDB for larger storage and structured queries
- **Background sync**: Queue writes when offline, sync when connection returns
- **Push notifications**: Service worker + Push API for daily care reminders
- **Multi-household support**: Move caretaker map to the spreadsheet itself rather than hardcoded config
- **Plant health tracking**: Add a Health tab for recording pest issues, diseases, growth milestones
- **Weather integration**: Adjust watering schedules based on local humidity/temperature data
- **Batch operations**: Water all due plants with a single tap
- **Photo gallery**: Multiple photos per plant with date stamps
