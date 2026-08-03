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
  localStorage
  (offline cache)
```

**Key architectural decisions:**
- No backend server — the browser communicates directly with Google APIs
- Google Sheets serves as both database and admin interface (data is viewable/editable in the spreadsheet UI)
- Google Drive provides photo storage with public thumbnail URLs
- Authentication uses the implicit grant flow via Google Identity Services (GIS) token client
- Local state management via Preact hooks (no external state library)

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | Preact | ^10.19.0 |
| Build Tool | Vite | ^5.4.0 |
| Vite Plugin | @preact/preset-vite | ^2.8.0 |
| Styling | Vanilla CSS (custom properties) | — |
| Auth | Google Identity Services (GIS) | Loaded from CDN |
| Data | Google Sheets API | v4 |
| Storage | Google Drive API | v3 |
| Cache | localStorage | Web API |
| Language | JavaScript (ES modules) | — |
| Package Manager | npm | — |

**CDN Dependencies (loaded in index.html):**
- `https://accounts.google.com/gsi/client` — Google Identity Services
- `https://apis.google.com/js/api.js` — Google API loader

## 3. Project Structure

```
vera-pwa/
├── index.html                      Entry point; loads GIS + GAPI scripts, mounts #app
├── package.json                    Dependencies: preact, vite, @preact/preset-vite
├── package-lock.json               Lockfile
├── vite.config.js                  Vite config with preact plugin, port 5173
├── dist/                           Production build output
│   ├── index.html
│   └── assets/
│       ├── index-CJHZIq4n.js       Bundled JS
│       └── index-R3Ftqt5Q.css      Bundled CSS
└── src/
    ├── main.jsx                    Renders <App /> into #app
    ├── app.jsx                     Root component; routing, auth gate, view state
    ├── config.js                   OAuth client ID, spreadsheet ID, scopes, caretaker map
    ├── components/
    │   ├── Header.jsx              Sticky header with app title, sync badge, user avatar, sign out
    │   ├── Dashboard.jsx           Main view: filter bar + plant cards grouped by urgency
    │   ├── PlantCard.jsx           Single plant row with urgency indicator and action buttons
    │   ├── FilterBar.jsx           Dropdowns for event type and location filtering
    │   ├── PlantDetail.jsx         Full plant info, schedules, activity, species guide, remove
    │   ├── AddPlantForm.jsx        Two-step form: plant metadata then schedule setup
    │   └── PhotoCapture.jsx        File input with camera capture, client-side resize, upload
    ├── hooks/
    │   ├── useGoogleAuth.js        GIS token client initialization, sign-in/out, user info
    │   └── useSheetsData.js        Data fetching, CRUD operations, optimistic updates, computed state
    ├── services/
    │   ├── sheets.js               Google Sheets API wrapper (batchGet, append, update, delete)
    │   ├── drive.js                Google Drive upload + thumbnail URL helper
    │   └── cache.js                localStorage get/set with versioning
    ├── utils/
    │   └── scheduleEngine.js       Schedule status computation, plant grouping/sorting
    └── styles/
        └── global.css              All application styles (CSS custom properties, mobile-first)
```

## 4. Authentication

### 4.1 Flow

1. **Initialization** (`useGoogleAuth.js`): On mount, polls for `window.google.accounts.oauth2` availability (retries every 100ms until the GIS script loads)
2. **Token Client Setup**: Calls `google.accounts.oauth2.initTokenClient()` with:
   - `client_id`: `988681646813-lh48egqaqajdapkm1mpjlimbba5pi2au.apps.googleusercontent.com`
   - `scope`: `openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file`
   - `callback`: Receives access token on successful consent
3. **Sign In**: `tokenClient.requestAccessToken({ prompt: 'consent' })` triggers the OAuth popup
4. **User Info**: After receiving the token, fetches `https://www.googleapis.com/oauth2/v3/userinfo` to get email, name, and profile picture
5. **Sign Out**: Calls `google.accounts.oauth2.revoke(accessToken)` and clears local state

### 4.2 Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `email` | Read user's email address |
| `profile` | Read user's name and profile picture |
| `https://www.googleapis.com/auth/spreadsheets` | Full read/write access to Google Sheets |
| `https://www.googleapis.com/auth/drive.file` | Access to files created by this app in Drive |

### 4.3 Caretaker Mapping

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
| `appendEvent(token, plant, eventType, outcome)` | POST | `/values/Events!A:D:append` | Appends a new event row |
| `appendRow(token, sheetName, values)` | POST | `/values/{sheet}!A:Z:append` | Generic row append (Inventory, Schedules) |
| `updateCell(token, range, value)` | PUT | `/values/{range}` | Updates a single cell (photo ID) |
| `updateRow(token, range, values)` | PUT | `/values/{range}` | Updates a full row (schedule cadence) |
| `getSheetMetadata(token)` | GET | `/?fields=sheets.properties` | Gets tab names and sheet IDs for delete ops |
| `deleteRow(token, sheetTabId, rowIndex)` | POST | `/:batchUpdate` | Deletes a single row by index |
| `deleteRows(token, sheetTabId, rowIndices)` | POST | `/:batchUpdate` | Deletes multiple rows (sorted descending to avoid index shift) |

#### Data Parsing

Raw sheet values are parsed into typed objects by helper functions:
- `parseInventory(rows)` — maps columns A-H to `{ name, species, caretaker, location, acquiredDate, photo, pot, notes }`
- `parseEvents(rows)` — maps columns A-D to `{ plant, timestamp, eventType, outcome }`
- `parseSchedules(rows)` — maps columns A-C to `{ plant, cadence (int), eventType }`
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
- `logEvent` — appends to `raw.events`
- `addPlant` — appends to `raw.inventory`
- `removePlant` — filters from `raw.inventory` and `raw.schedules`
- `addSchedule` — appends to `raw.schedules`
- `updateSchedule` — maps over `raw.schedules`
- `removeSchedule` — filters from `raw.schedules`
- `updatePlantPhoto` — maps over `raw.inventory` to update photo field

## 6. Schedule Engine

### 6.1 Algorithm (`src/utils/scheduleEngine.js`)

#### `computeScheduleStatus(schedules, events, inventory)`

```
FOR each schedule (plant, cadence, eventType):
    matchingEvents = events WHERE plant AND eventType match, sorted DESC by timestamp
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

    RETURN { ...schedule, lastDone, nextDue, daysOverdue, plant: inventory[plant] }
```

#### `groupByPlant(scheduleStatuses)`

```
FOR each scheduleStatus:
    GROUP by plant.name
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

**Responsibility:** Root component managing view routing and connecting auth with data.

**State:**
- `selectedPlant` — currently viewed plant object (or null)
- `view` — one of `'dashboard'`, `'detail'`, `'addPlant'`

**Renders:** Conditionally renders login screen, AddPlantForm, PlantDetail, or Dashboard based on auth state and view.

### 7.2 Header (`src/components/Header.jsx`)

**Props:**
- `user: { email, name, picture }` — signed-in user
- `onSignOut: () => void` — sign out handler
- `syncStatus: 'idle' | 'syncing' | 'synced' | 'error'` — current sync state

**Responsibility:** Sticky top bar with app title, sync status badge, user avatar, and sign-out button.

### 7.3 Dashboard (`src/components/Dashboard.jsx`)

**Props:**
- `data` — full useSheetsData return value
- `caretaker: string` — current user's caretaker name
- `onSelectPlant: (plant) => void` — navigate to detail
- `onAction: (plant, eventType, outcome) => void` — log an event
- `onAddPlant: () => void` — navigate to add plant form

**State:**
- `filterType` — event type filter (default: `'all'`)
- `filterLocation` — location filter (default: `'all'`)

**Responsibility:** Filters plant list, splits into "Needs Attention" vs "Upcoming" sections, renders PlantCards, shows FAB.

### 7.4 PlantCard (`src/components/PlantCard.jsx`)

**Props:**
- `entry: { plant, schedules, maxOverdue, _dueEventType }` — grouped plant data
- `onSelect: () => void` — tap handler for navigation
- `onAction: (plant, eventType, outcome) => void` — inline action buttons

**Responsibility:** Single plant row with urgency color coding, name, location, due info, and Done/Snooze/Skip buttons.

### 7.5 FilterBar (`src/components/FilterBar.jsx`)

**Props:**
- `eventTypes: string[]` — available event types
- `locations: string[]` — unique locations from inventory
- `filterType: string` — current type filter value
- `filterLocation: string` — current location filter value
- `onTypeChange: (value) => void`
- `onLocationChange: (value) => void`

**Responsibility:** Two dropdown selects for filtering the dashboard by event type and location.

### 7.6 PlantDetail (`src/components/PlantDetail.jsx`)

**Props:**
- `plant: { name, species, caretaker, location, acquiredDate, photo, pot, notes, _dueEventType }` — plant data
- `data` — full useSheetsData return value
- `onBack: () => void` — return to dashboard
- `onAction: (outcome) => void` — log event for the most urgent schedule
- `onRemove: (plantName) => void` — delete plant

**State:**
- `showConfirmRemove` — remove confirmation toggle
- `editingSchedule` / `editCadence` — inline schedule edit state
- `addingSchedule` / `newSchedType` / `newSchedCadence` — new schedule form state
- `loggingEvent` / `adHocType` — ad-hoc event logging state

**Responsibility:** Full plant information display with all management capabilities (schedules, photos, events, removal).

**Helper Component:** `CareItem({ label, value })` — renders species care data with paragraph splitting (`|` delimiter) and collapsible common issues (`||` delimiter between issues).

### 7.7 AddPlantForm (`src/components/AddPlantForm.jsx`)

**Props:**
- `data` — for species list, event types, existing locations
- `onSubmit: (plantData) => Promise<void>` — create plant
- `onAddSchedule: (plant, cadence, eventType) => Promise<void>` — add schedule
- `onCancel: () => void` — return to dashboard

**State:** Form fields (name, species, caretaker, location, acquiredDate, pot, notes), submission state, and post-add schedule management (plantAdded, schedules array).

**Responsibility:** Two-phase form — first collects plant metadata, then (after successful creation) allows adding multiple care schedules.

### 7.8 PhotoCapture (`src/components/PhotoCapture.jsx`)

**Props:**
- `onUpload: (file: Blob) => Promise<void>` — callback with resized image

**State:**
- `uploading` — loading state during upload

**Responsibility:** File input with `capture="environment"` for mobile camera, client-side image resizing (max 1200px width, 85% JPEG quality), and upload delegation.

## 8. Google Drive Integration

### 8.1 Photo Upload Flow (`src/services/drive.js`)

```
1. User selects/captures image
2. PhotoCapture.resizeImage():
   - Create Image element from file blob
   - If width > 1200px, scale proportionally
   - Draw to canvas at target dimensions
   - Export as JPEG blob at 0.85 quality
3. drive.uploadPhoto(token, blob, plantName):
   - Generate filename: "{plantName}_{ISO-timestamp}.jpg"
   - Build multipart form:
     - Part 1: JSON metadata { name, mimeType: "image/jpeg" }
     - Part 2: Binary image blob
   - POST to: https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id
   - Returns: Google Drive file ID
4. useSheetsData.updatePlantPhoto():
   - Writes file ID to Inventory!F{row} via updateCell
   - Updates local state
```

### 8.2 Photo Display

```javascript
// drive.js: getPhotoUrl(fileId)
`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
```

This URL returns a publicly accessible thumbnail at 800px width. It works without additional sharing configuration because the `drive.file` scope grants access to files created by the app.

## 9. Setup Instructions

### 9.1 Google Cloud Project Setup

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
   - Authorized JavaScript origins: `http://localhost:5173` (dev), plus your production domain
   - No redirect URIs needed (GIS uses popup flow)
6. Copy the Client ID

### 9.2 Google Sheet Setup

1. Create a new Google Spreadsheet
2. Create the following tabs with exact names and column headers:

**Tab: Inventory**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Name | Species | Caretaker | Location | Acquired Date | Photo | Pot | Notes |

**Tab: Events**
| A | B | C | D |
|---|---|---|---|
| Plant | Timestamp | Event Type | Outcome |

**Tab: Schedules**
| A | B | C |
|---|---|---|
| Plant | Cadence | Event Type |

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

### 9.3 Species Tab Population

Populate the Species tab with care information for your plants. The following fields support rich text formatting:
- Most text fields: Use `|` as a paragraph separator
- Common Issues: Use `||` to separate different issues; within each issue, format as `Title: description` where description paragraphs are separated by `|`

Example Common Issues value:
```
Root Rot: Caused by overwatering|Allow soil to dry between waterings||Brown Tips: Usually from low humidity|Mist regularly or use a pebble tray
```

### 9.4 Local Development

```bash
# Clone the repository
git clone <repo-url>
cd vera-pwa

# Install dependencies
npm install

# Start development server
npm run dev
# App available at http://localhost:5173
```

### 9.5 Environment Configuration

Edit `src/config.js` with your values:

```javascript
export const CONFIG = {
  // OAuth Client ID from GCP Console
  OAUTH_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

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

### 9.6 Production Build

```bash
# Build for production
npm run build
# Output in dist/

# Preview production build locally
npm run preview
```

The `dist/` directory contains a static site that can be deployed to any static hosting provider (Netlify, Vercel, GitHub Pages, Cloudflare Pages, Firebase Hosting, etc.).

## 10. Future Considerations

### 10.1 PWA Manifest and Service Worker

The app currently has `<meta name="theme-color" content="#5CB947">` but lacks:
- `manifest.json` with app name, icons, display mode, start URL
- Service worker for offline caching of the app shell and API responses
- Push notification support for care reminders

Adding these would enable:
- Home screen installation on iOS/Android
- Full offline functionality (currently read-only when offline)
- Background sync for queued writes

### 10.2 Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| GitHub Pages | Free, auto-deploy from repo | Custom domain requires config |
| Netlify | Free tier, preview deploys, custom domains | Account required |
| Vercel | Free tier, instant deploys | Account required |
| Firebase Hosting | Free tier, Google ecosystem | More setup complexity |
| Cloudflare Pages | Free, fast global CDN | Account required |

Since the app is fully client-side with no server, any static hosting works.

### 10.3 Potential Migration Paths

- **IndexedDB**: Replace localStorage cache with IndexedDB for larger storage and structured queries
- **Firestore**: Migrate from Sheets to Firestore for real-time sync, offline writes, and better query performance
- **Supabase/PlanetScale**: SQL database with REST API if relational queries become complex
- **Native notifications**: Service worker + Push API for daily care reminders
- **Multi-household support**: Move caretaker map to the spreadsheet itself rather than hardcoded config
- **Plant health tracking**: Add a Health tab for recording pest issues, diseases, growth milestones
- **Weather integration**: Adjust watering schedules based on local humidity/temperature data
