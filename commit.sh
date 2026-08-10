#!/bin/bash
git add -A && git commit -m "Add crop UI, care fields, improved backfill script

Photos:
- Full-screen crop overlay after capture with drag-to-pan and pinch-to-zoom
- Square crop frame (85vw), user selects framing before upload
- CropOverlay component with touch + mouse support, GPU-accelerated transforms

Care fields:
- Light, Water, Humidity, Fertilizing columns (J-M) in Inventory sheet
- Displayed in detail view with multiline rendering
- Editable in edit mode, copied on propagation
- Auto-filled from species data when creating plants

Backfill:
- Updated script uses only species matches (no guessing from notes)
- AI-extracted care data for 36 additional plants from their notes
- Final coverage: 128/134 plants with care data

Specs:
- Product and system specs updated with crop UI, CropOverlay component docs" && git push
