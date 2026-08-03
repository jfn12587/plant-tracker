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

- Users authenticate via Google Sign-In (Google Identity Services OAuth2 token client)
- OAuth scopes: `openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file`
- A static **caretaker map** in `src/config.js` resolves Google email addresses to display names
- If an unrecognized email signs in, the caretaker name falls back to the Google profile display name
- Plants are assigned a caretaker in the Inventory sheet, enabling per-user filtering in the future

### Multi-User Model

Both users share a single Google Sheet as the data store. All plants, events, and schedules are visible to both users. The caretaker field on each plant indicates primary responsibility but does not restrict access.

## 3. Core Use Cases

### 3.1 View Plants Needing Attention

**Dashboard view** displays all plants grouped into two sections:
- **Needs Attention** — plants with at least one schedule that is due today or overdue (daysOverdue >= 0)
- **Upcoming** — plants whose next care event is in the future (daysOverdue < 0)

Plants are sorted by urgency (most overdue first). Each plant card shows:
- Plant name
- Location tag
- Most urgent event type and urgency label (e.g., "Watering - 3d overdue")
- Color-coded left border: red (overdue/never done), yellow (due today), green (upcoming)

### 3.2 Take Action on Scheduled Care

From either the Dashboard card or the Plant Detail view, users can take three actions on the most urgent scheduled event:

| Action | Button | Effect on Schedule |
|--------|--------|-------------------|
| **Done** | Checkmark | Resets the schedule; next due = today + cadence days |
| **Snoozed** | Clock | Pushes next due to 2 days from now |
| **Skipped** | Fast-forward | Extends the cycle by one additional cadence period per skip |

Each action appends a row to the Events sheet with: plant name, ISO timestamp, event type, and outcome.

### 3.3 Log Ad-Hoc Events

From the Plant Detail view, users can log events that occur outside of any schedule:
1. Click "+ Log Event"
2. Select any event type from the dropdown (includes all types from the Event Types sheet)
3. Click "Log Done" to record a Done event immediately

This supports tracking activities like repotting or pest treatment that may not have a recurring schedule.

### 3.4 View Full Plant Detail

Tapping a plant card navigates to the Plant Detail view, which displays:
- **Photo** — retrieved from Google Drive via thumbnail URL if a file ID exists
- **Plant name and species**
- **Metadata grid** — location, caretaker, acquired date, pot description, notes
- **Activity section** — all event types recorded for this plant, with last-done date, schedule cadence (if scheduled), and total event count
- **Care Schedule section** — each active schedule with cadence, urgency status, and action buttons (Done/Snooze/Skip/Edit/Remove)
- **Species Care Guide** — detailed care instructions from the Species sheet (light, water, humidity, temperature, food, toxicity, pet safety, additional care, common issues)

### 3.5 Add and Remove Plants

**Add Plant:**
1. Tap the floating "+" button on the dashboard
2. Fill in the form: Name (required), Species (autocomplete from Species sheet), Caretaker (dropdown), Location (autocomplete from existing locations), Acquired Date, Pot, Notes
3. Submit to append a row to the Inventory sheet
4. Immediately transitions to a schedule setup screen to add one or more care schedules

**Remove Plant:**
1. From Plant Detail, tap "Remove Plant"
2. Confirm the destructive action in a confirmation dialog
3. Removes the plant row from Inventory and all associated rows from Schedules

### 3.6 Manage Schedules

From the Plant Detail Care Schedule section:

- **Add Schedule** — select an event type not already scheduled for this plant, enter cadence in days
- **Edit Cadence** — click the edit button on a schedule row, change the number of days, save
- **Remove Schedule** — click the X button to delete the schedule row from the Schedules sheet

### 3.7 Take and View Photos

- **View:** If a plant has a photo file ID stored in the Inventory sheet, the detail view shows the image via Google Drive thumbnail URL (`https://drive.google.com/thumbnail?id={fileId}&sz=w800`)
- **Capture/Upload:** The PhotoCapture component provides a file input with `capture="environment"` for mobile camera access. Images are:
  1. Resized client-side to max 1200px width at 85% JPEG quality
  2. Uploaded to Google Drive via multipart upload
  3. The returned file ID is written to the Inventory sheet's photo column

## 4. Data Model

All data lives in a single Google Spreadsheet (ID: `16KzR3l0V6-aQe7Lus5eEsnR8Y0ncoW7YGshReJtjhkY`) with five tabs:

### 4.1 Inventory (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Name | Unique plant name (primary key) |
| B | Species | Common species name (references Species tab) |
| C | Caretaker | Assigned caretaker (Josh or Deanna) |
| D | Location | Physical location in the home |
| E | Acquired Date | Date the plant was acquired |
| F | Photo | Google Drive file ID for the plant photo |
| G | Pot | Pot description (type, size) |
| H | Notes | Free-text notes |

### 4.2 Events (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Plant | Plant name (foreign key to Inventory.Name) |
| B | Timestamp | ISO 8601 timestamp of the event |
| C | Event Type | Type of care event (references Event Types) |
| D | Outcome | One of: `Done`, `Snoozed`, `Skipped` |

This is an append-only log. Events are never modified or deleted.

### 4.3 Schedules (Sheet Tab)

| Column | Field | Description |
|--------|-------|-------------|
| A | Plant | Plant name (foreign key to Inventory.Name) |
| B | Cadence | Number of days between care events |
| C | Event Type | Type of care event (references Event Types) |

A plant can have multiple schedules (e.g., Water every 7 days, Fertilize every 30 days).

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

1. For each schedule (plant + event type + cadence):
   - Find all matching events (same plant and event type), sorted newest first
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

### 5.3 Mobile-First Design

- Viewport meta tag: `width=device-width, initial-scale=1.0, user-scalable=no`
- System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Touch-friendly: minimum 44px tap targets, 36px action buttons
- Responsive layout: CSS grid with mobile-appropriate column counts
- Sticky header for persistent navigation
- Floating action button (FAB) for quick plant addition
- Camera capture via `capture="environment"` attribute on file inputs

### 5.4 PWA Installability

- Theme color set to `#5CB947` (brand green) via meta tag
- Single-page application architecture suitable for service worker caching
- No current manifest.json or service worker (future enhancement)

### 5.5 Sync Status Feedback

The UI displays sync status in the header:
- **Syncing** — yellow badge while a write operation is in progress
- **Error** — red badge if a write operation fails
- **Synced** — no badge (success state is implicit)

### 5.6 Optimistic Updates

Write operations (logEvent, addPlant, removePlant, etc.) update local state immediately before the API call completes, providing instant UI feedback. If the API call fails, the sync status badge shows an error.
