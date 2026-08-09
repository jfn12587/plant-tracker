#!/bin/bash
git add -A && git commit -m "Add per-plant care fields, species auto-fill, multiline rendering, backfill script

New features:
- Light, Water, Humidity, Fertilizing free-text fields on each plant (columns J-M)
- Multiline text preserved in Notes and care fields (pre-wrap rendering)
- Species auto-fill: selecting a species in Add Plant form populates care fields
- Care fields copied on plant propagation

Tooling:
- scripts/backfill-care-fields.py generates TSV from species data for bulk import
- .gitignore updated to exclude CSVs, TSVs, and commit.sh

Specs:
- Product and system specs updated with new schema, components, and backfill docs" && git push
