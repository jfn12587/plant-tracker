# Plant Tracker PWA - Product Specification

## 1. Overview

Plant Tracker is a Progressive Web Application for managing houseplant care schedules. It replaces **Vera by Bloomscape**, a commercial plant care app that was discontinued when Bloomscape shut down. The app provides schedule-driven reminders for watering, fertilizing, and other recurring plant care tasks, backed by a Google Sheets database for zero-cost persistence and easy data portability.

The core value proposition is answering one question every day: **"Which plants need attention right now, and what do they need?"**

## 2. Users

### Primary Users

| User | Google Account(s) | Caretaker Name |
|------|-------------------|----------------|
| Josh | `josh@nedelka.com`, `jfn12587@gmail.com` | Josh |
| Deanna | `drflaherty89@gmail.com` | Deanna |

### Authentication and Identity

- Users authenticate via Google Sign-In (Google Identity Services OAuth2 authorization code flow)
- OAuth scopes: `openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file`
- A static **caretaker map** in `src/config.js` resolves Google email addresses to display names
- If an unrecognized email signs in, the caretaker name falls back to the Google profile display name
- Plants are assigned a caretaker in the Inventory sheet, enabling per-user filtering in the future

### Login Persistence

- A **refresh token** is stored in `localStorage` under key `vera-pwa-refresh-token` (persistent across sessions)
- User profile data is stored in `localStorage` under key `vera-pwa-user`
- Access tokens are kept in memory only (not persisted) and refreshed automatically before expiry
- On app load, if a refresh token exists, it is exchanged for a fresh access token silently (user sees "Signing in...")
- If the refresh token is revoked or invalid, it is cleared and the user must re-authenticate manually
- No automatic OAuth popup on load; the user must explicitly click "Sign in with Google" only on first use
- Using `localStorage` for the refresh token ensures persistent login that survives app restarts, mobile OS process kills, and browser closures
- Sessions are effectively permanent until the user explicitly signs out or revokes access

### Multi-User Model

Both users share a single Google Sheet as the data store. All plants, events, and schedules are visible to both users. The caretaker field on each plant indicates primary responsibility. By default, the dashboard filters to show only the signed-in user's plants ("My Plants"). Users can toggle to "All Plants" to see everything.

## 3. Core Use Cases

### 3.1 View Plants Needing Attention

**Dashboard view** displays plants in three sections (when sorted by urgency):
- **Needs Attention** — plants with at least one schedule that is due today or overdue (daysOverdue >= 0)
- **Upcoming** — plants whose next care event is in the future (daysOverdue < 0)
- **No Schedule** — plants with no care schedule assigned, shown with quick action buttons

Each plant card shows:
- Plant name
- Location tag
- "Last watered" tag showing how many days since last watering (e.g., "today", "3d ago")
- Most urgent event type and urgency label (e.g., "Water — 3d overdue")
- Color-coded left border: red (overdue/never done), yellow (due today), green (upcoming), neutral (unscheduled)
- Thumbnail photo (when image toggle is active)
- Quick action buttons: Water, Fertilize, Repot
- Snooze/Skip buttons (second row, only for scheduled plants)

### 3.2 Sort and Filter

The dashboard provides three ways to organize the plant list:

**Sort modes (four options):**
- **Needs Attention** (default) — groups plants into Needs Attention / Upcoming / No Schedule sections, sorted by urgency within each
- **Plant Name** — flat alphabetical list of all plants (scheduled and unscheduled together)
- **Location** — groups all plants by their location, alphabetically within each group
- **Acquired Date** — flat list sorted by acquired date (newest first); plants without an acquired date appear at the bottom

**Filters:**
- **Caretaker filter** — defaults to "My Plants" (shows only the signed-in user's plants). Toggle to "All Plants" to see everything.
- **Event Type filter** — show only plants with a specific scheduled event type (Water, Fertilize, etc.)
- **Location filter** — show only plants in a specific location
- **Search bar** — sticky text input that filters plants by name, location, or species (case-insensitive substring match)

All filter and sort state persists across navigation to detail/add views and back. State is maintained in the App component, not reset on view change.

### 3.3 Image Toggle

A button in the header toggles thumbnail visibility on the dashboard. When active, plant cards display a small photo if available. The detail page always shows the full plant photo regardless of this toggle.

### 3.4 Take Action on Scheduled Care

From either the Dashboard card or the Plant Detail view, users can take actions on scheduled events:

**Quick action buttons (first row, always visible):**

| Action | Button | Effect |
|--------|--------|--------|
| **Water** | Water droplet | Logs a "Done" event for Water immediately |
| **Fertilize** | Leaf | Logs a "Done" event for Fertilize immediately |
| **Repot** | Potted plant | Logs a "Done" event for Repot immediately |

**Schedule management buttons (second row, scheduled plants only):**

| Action | Button | Effect on Schedule |
|--------|--------|-------------------|
| **Snoozed** | Clock | Pushes next due to 2 days from now |
| **Skipped** | Fast-forward | Extends the cycle by one additional cadence period per skip |

Each action appends a row to the Events sheet with: plant ID, ISO timestamp, event type, and outcome.

### 3.5 Log Ad-Hoc Events

From the Plant Detail view, users can log events that occur outside of any schedule:
1. Click "+ Log Event"
2. Select any event type from the dropdown (includes all types from the Event Types sheet)
3. Optionally select a back-date via the date picker (defaults to current time if omitted)
4. Click "Log Done" to record a Done event

This supports tracking activities like repotting or pest treatment that may not have a recurring schedule, and allows recording events that happened in the past.

### 3.6 View Full Plant Detail

Tapping a plant card navigates to the Plant Detail view, which displays:
- **Photo** — always shown if available, retrieved from Google Drive via thumbnail URL
- **Plant name and species**
- **Edit/Propagate action bar** — buttons to enter edit mode or propagate the plant
- **Quick action buttons** — Water, Fertilize, Repot at the top of the detail page
- **Photo capture section** — file input for taking or uploading a new photo
- **Metadata grid** — location, caretaker, acquired date, pot description, notes (all inline-editable)
- **Care fields** — Light, Water, Humidity, and Fertilizing per-plant care notes (inline-editable, multiline)
- **Activity section** — all event types recorded for this plant, with last-done date, schedule cadence (if scheduled), and total event count
- **Care Schedule section** — each active schedule with cadence, urgency status, and action buttons (Done/Snooze/Skip/Edit/Remove)
- **Species Care Guide** — detailed care instructions from the Species sheet (light, water, humidity, temperature, food, toxicity, pet safety, additional care, common issues)
- **Remove Plant** — destructive action with confirmation dialog

Notes and care fields (Light, Water, Humidity, Fertilizing) preserve newlines using a MultilineText component that renders content with `white-space: pre-wrap`.

### 3.7 Edit Plant Details

From the Plant Detail view, users can edit plant metadata inline:
1. Click "Edit" button in the action bar
2. Name, Location, Caretaker, Pot, Notes, Light, Water, Humidity, and Fertilizing fields become editable inputs
3. Click "Save" to persist changes or "Cancel" to discard
4. Changes are written to the full Inventory row (columns A-M) via `updatePlant()`

The Acquired Date and Species fields are not editable from this interface.

### 3.8 Propagate Plant

From the Plant Detail view, users can create a new plant derived from the current one:
1. Click "Propagate" button in the action bar
2. The Add Plant form opens pre-filled with:
   - Name: "{original name} Baby"
   - Same species, caretaker, location, pot, notes, light, water, humidity, and fertilizing as the parent
   - Acquired Date: today's date
3. User can modify any pre-filled fields before saving
4. On submit, a new plant is created with an auto-generated unique ID

### 3.9 Add and Remove Plants

**Add Plant:**
1. Tap the floating "+" button on the dashboard
2. Fill in the form: Name (required), Species (autocomplete from Species sheet), Caretaker (dropdown), Location (autocomplete from existing locations), Acquired Date, Pot, Notes, Light, Water, Humidity, Fertilizing
3. When a species is selected from the datalist, the Light, Water, Humidity, and Fertilizing fields are auto-filled from the Species sheet data (user can override)
4. Submit to append a row to the Inventory sheet with an auto-generated unique ID (P001, P002, ...)
5. Immediately transitions to a schedule setup screen to add one or more care schedules

**Remove Plant:**
1. From Plant Detail, tap "Remove Plant"
2. Confirm the destructive action in a confirmation dialog
3. Removes the plant row from Inventory and all associated rows from Schedules

### 3.10 Manage Schedules

From the Plant Detail Care Schedule section:

- **Add Schedule** — select an event type not already scheduled for this plant, enter cadence in days
- **Edit Cadence** — click the edit button on a schedule row, change the number of days, save
- **Remove Schedule** — click the X button to delete the schedule row from the Schedules sheet

### 3.11 Take and View Photos

- **View:** If a plant has a photo file ID stored in the Inventory sheet, the detail view always shows the image via Google Drive thumbnail URL. Dashboard cards show thumbnails when the image toggle is active.
- **Capture/Upload:** The PhotoCapture component provides a file input with `capture="environment"` for mobile camera access. The file picker is hidden when a photo already exists, unless the user is in edit mode (to allow replacing the photo). After capture:
  1. A full-screen **crop overlay** appears, showing the image with a square crop frame
  2. The user can **drag** (pan) the image and **pinch to zoom** to frame the subject
  3. "Confirm" crops the selected region to a square at max 1200x1200px, 85% JPEG quality
  4. "Cancel" discards the photo and returns to the detail page
  5. The cropped image is uploaded to Google Drive via multipart upload
  6. Made publicly viewable via a permissions API call (role: reader, type: anyone)
  7. The returned file ID is written to the Inventory sheet's Photo column (column G)

### 3.12 Activity History

The Activity section on the Plant Detail page shows a comprehensive history for the plant:
- Lists every event type that has been recorded for the plant (not just scheduled types)
- For each event type: last completed date, total event count, and cadence (if scheduled)
- Provides context for ad-hoc events alongside scheduled ones
- A "Show All" button expands a full event table showing every individual event (newest first) with:
  - Timestamp, event type, and outcome columns
  - Edit button: allows inline editing of event type and outcome
  - Delete button: removes the event from the Events sheet
- The table can be collapsed again with "Hide All"

### 3.13 Back Button Support

The app uses `history.pushState` to manage browser history. When navigating from the dashboard to a detail or add-plant view, a history entry is pushed. Pressing the Android hardware back button (or browser back) triggers `popstate`, returning the user to the dashboard instead of closing the app or navigating away.

## 4. Data Model

All data lives in a single Google Spreadsheet (ID: `16KzR3l0V6-aQe7Lus5eEsnR8Y0ncoW7YGshReJtjhkY`) with five tabs:

### 4.1 Inventory (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | ID | Unique plant identifier (P001, P002, ...) — primary key, auto-generated |
| B | Name | Display name for the plant |
| C | Species | Common species name (references Species tab) |
| D | Caretaker | Assigned caretaker (Josh or Deanna) |
| E | Location | Physical location in the home |
| F | Acquired Date | Date the plant was acquired |
| G | Photo | Google Drive file ID for the plant photo |
| H | Pot | Pot description (type, size) |
| I | Notes | Free-text notes |
| J | Light | Per-plant light care notes (free text, multiline) |
| K | Water | Per-plant watering care notes (free text, multiline) |
| L | Humidity | Per-plant humidity care notes (free text, multiline) |
| M | Fertilizing | Per-plant fertilizing care notes (free text, multiline) |

The ID field uses the format `P` followed by a zero-padded three-digit number. When adding a new plant, the app scans existing IDs to determine the next available number.

### 4.2 Events (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Plant ID | Plant identifier (foreign key to Inventory.ID) |
| B | Timestamp | ISO 8601 timestamp of the event |
| C | Event Type | Type of care event (references Event Types) |
| D | Outcome | One of: `Done`, `Snoozed`, `Skipped` |

Events are primarily append-only but can be individually edited (event type, outcome) or deleted via the "Show All" event table in the Plant Detail view.

### 4.3 Schedules (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Plant ID | Plant identifier (foreign key to Inventory.ID) |
| B | Cadence | Number of days between care events |
| C | Event Type | Type of care event (references Event Types) |

A plant can have multiple schedules (e.g., Water every 7 days, Fertilize every 30 days). There are no formula columns in this sheet.

### 4.4 Event Types (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Name | Event type name (e.g., Water, Fertilize, Rotate, Dust, Repot) |

This is a reference list used to populate dropdowns throughout the UI.

### 4.5 Species (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Name | Common species name |
| B | Scientific Name | Latin binomial |
| C | Family | Plant family |
| D | Light | Light requirements |
| E | Water | Watering guidelines |
| F | Humidity | Humidity preferences |
| G | Temperature | Temperature range |
| H | Food | Fertilization guidelines |
| I | Toxicity | Toxicity information |
| J | Pet Friendly | Pet safety (Yes/No with details) |
| K | Additional Care | Extra care notes |
| L | Common Issues | Known problems (delimited by `||` for multiple issues, `|` for paragraphs within an issue) |

### 4.6 Schedule Engine Logic

The schedule engine (`src/utils/scheduleEngine.js`) computes the urgency state for each plant-schedule pair:

**Core Algorithm:**

1. For each schedule (plant ID + event type + cadence):
   - Find all matching events (same plant ID and event type), sorted newest first
   - Find the most recent event with outcome = "Done" (`lastDone`)

2. Compute `nextDue`:
   - If `lastDone` is null: `nextDue = null` (treated as immediately due, `daysOverdue = Infinity`)
   - Otherwise, look at events that occurred after `lastDone`:
     - If most recent post-Done event is **Snoozed**: `nextDue = snoozeTimestamp + 2 days`
     - If most recent post-Done event is **Skipped**: `nextDue = lastDone + (cadence * (1 + skipCount))` where skipCount is total Skipped events after lastDone
     - Otherwise (no modifiers): `nextDue = lastDone + cadence`

3. Compute `daysOverdue`:
   - `daysOverdue = floor((today - nextDue) / oneDay)`
   - Positive = overdue, zero = due today, negative = upcoming
   - If `nextDue` is null: `daysOverdue = Infinity` (most urgent)

4. **groupByPlant** aggregates all schedule statuses per plant, tracks the maximum overdue value, and sorts plants descending by urgency.

## 5. Non-Functional Requirements

### 5.1 Offline Support

- **localStorage cache**: All sheet data is cached on successful fetch under the key `vera-pwa-data` with a version number
- On app load, cached data renders immediately while a fresh fetch happens in the background
- If the network is unavailable, the last-cached state is displayed (read-only; writes will fail)

### 5.2 Caching Strategy

- Cache key: `vera-pwa-data`
- Cache structure: `{ version: 1, timestamp: Date.now(), data: { inventory, events, schedules, eventTypes, species } }`
- Cache is refreshed on every successful `fetchAllData` call
- Version field allows cache invalidation on schema changes
- Failure: Silently catches localStorage errors (quota exceeded, private browsing)

### 5.3 Mobile-First Design

- Viewport meta tag: `width=device-width, initial-scale=1.0, user-scalable=no`
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Touch-friendly: minimum 44px tap targets, 36px action buttons
- Responsive layout: CSS grid with mobile-appropriate column counts
- Sticky header for persistent navigation
- Sticky search bar at the top of the dashboard
- Floating action button (FAB) for quick plant addition
- "Back to top" button appears after scrolling down 400px
- Camera capture via `capture="environment"` attribute on file inputs
- Scroll-to-top on navigation to detail/addPlant views

### 5.4 PWA Installability

- `manifest.json` with app name ("Plant Tracker"), icons (192px and 512px), standalone display mode, start URL `/plant-tracker/`, and theme color `#5CB947`
- Service worker registered at `/plant-tracker/sw.js` for installability
- Theme color set to `#5CB947` (brand green) via meta tag and manifest
- App ID set to `/plant-tracker/` for consistent identity across installs

### 5.5 Deployment

The app is deployed to **GitHub Pages** via a GitHub Actions workflow:
- Triggered on push to the `master` branch or manual dispatch
- Builds with Node 20, runs `npm ci` and `npm run build`
- Deploys the `dist/` directory as a GitHub Pages artifact
- Base path configured as `/plant-tracker/` in Vite config
- Production URL: `https://<username>.github.io/plant-tracker/`

### 5.6 Sync Status Feedback

The UI displays sync status in the header:
- **Syncing** — yellow badge while a write operation is in progress
- **Error** — red badge if a write operation fails
- **Synced** — no badge (success state is implicit)

### 5.7 Optimistic Updates

Write operations (logEvent, addPlant, removePlant, etc.) update local state immediately before the API call completes, providing instant UI feedback. If the API call fails, the sync status badge shows an error.
