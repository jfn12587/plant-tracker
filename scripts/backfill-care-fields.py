#!/usr/bin/env python3
"""
Backfill care fields (Light, Water, Humidity, Fertilizing) for plants in the inventory
by matching them to species data AND parsing existing Notes for care info.

Priority:
  1. Species data (structured, reliable)
  2. Notes parsing (best-effort extraction for unmatched plants)

Reads:
  - /Users/jfn/ApkProjects/Vera/vera_species.tsv (species care data)
  - /Users/jfn/ApkProjects/Vera/inventory_with_ids.csv (current plant inventory)

Outputs:
  - TSV with 4 columns (Light, Water, Humidity, Fertilizing) in inventory row order
  - Can be pasted directly into columns J:M of the Inventory sheet

Usage:
  python3 scripts/backfill-care-fields.py > care_fields.tsv
"""

import csv
import os
import re
import sys

SPECIES_TSV = os.path.join(os.path.dirname(__file__), '..', '..', 'Vera', 'vera_species.tsv')
INVENTORY_CSV = os.path.join(os.path.dirname(__file__), '..', '..', 'Vera', 'inventory_with_ids.csv')

LIGHT_KEYWORDS = [
    'bright light', 'low light', 'indirect light', 'direct light', 'full sun',
    'bright sun', 'strong light', 'partial shade', 'any amount of light',
    'morning sun', 'sunny', 'shade',
]

WATER_KEYWORDS = [
    'water when dry', 'water only when dry', 'water once', 'water weekly',
    'infrequent watering', 'dry out', 'soak', 'bottom or top',
    'water less', 'don\'t soak', 'thoroughly', 'err on the side of no water',
    'don\'t water bulb', 'mist',
]


def load_species(path):
    """Load species TSV into a dict keyed by name and scientific name."""
    species = {}
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            name = row.get('Species Name', '').strip()
            sci_name = row.get('Scientific Name', '').strip()
            entry = {
                'light': row.get('Light', '').strip(),
                'water': row.get('Water', '').strip(),
                'humidity': row.get('Humidity', '').strip(),
                'fertilizing': row.get('Food', '').strip(),
            }
            if name:
                species[name.lower()] = entry
            if sci_name:
                species[sci_name.lower()] = entry
    return species


def load_inventory(path):
    """Load inventory CSV."""
    plants = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            plants.append(row)
    return plants


def match_species(plant_species, plant_name, species_data):
    """Try to match a plant's species or name to species data."""
    for key_source in [plant_species, plant_name]:
        if not key_source:
            continue
        key = key_source.strip().lower()
        if key in species_data:
            return species_data[key]
        for sp_key, sp_val in species_data.items():
            if key in sp_key or sp_key in key:
                return sp_val
    return None


def extract_from_notes(notes):
    """Best-effort extraction of care info from free-text notes."""
    if not notes:
        return {'light': '', 'water': '', 'humidity': '', 'fertilizing': ''}

    notes_lower = notes.lower()
    light_parts = []
    water_parts = []

    # Extract sentences containing light keywords
    sentences = re.split(r'[.!]\s*', notes)
    for sentence in sentences:
        sentence_lower = sentence.lower().strip()
        if not sentence_lower:
            continue

        is_light = any(kw in sentence_lower for kw in LIGHT_KEYWORDS)
        is_water = any(kw in sentence_lower for kw in WATER_KEYWORDS)

        if is_light and not is_water:
            light_parts.append(sentence.strip())
        elif is_water and not is_light:
            water_parts.append(sentence.strip())
        elif is_light and is_water:
            # Contains both — put in water (more actionable)
            water_parts.append(sentence.strip())

    return {
        'light': '. '.join(light_parts),
        'water': '. '.join(water_parts),
        'humidity': '',
        'fertilizing': '',
    }


def main():
    species_path = os.path.abspath(SPECIES_TSV)
    inventory_path = os.path.abspath(INVENTORY_CSV)

    if not os.path.exists(species_path):
        print(f"Error: Species file not found at {species_path}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(inventory_path):
        print(f"Error: Inventory file not found at {inventory_path}", file=sys.stderr)
        sys.exit(1)

    species_data = load_species(species_path)
    plants = load_inventory(inventory_path)

    print(f"Loaded {len(species_data) // 2} species entries", file=sys.stderr)
    print(f"Loaded {len(plants)} plants from inventory", file=sys.stderr)
    print(file=sys.stderr)

    # Output header
    print("Light\tWater\tHumidity\tFertilizing")

    matched_species = 0
    matched_notes = 0
    unmatched = 0

    for plant in plants:
        plant_name = plant.get('Name', '')
        plant_species = plant.get('Species', '')
        plant_notes = plant.get('Notes', '')

        # Try species match first
        match = match_species(plant_species, plant_name, species_data)

        if match and (match['light'] or match['water'] or match['humidity'] or match['fertilizing']):
            matched_species += 1
            light = match['light']
            water = match['water']
            humidity = match['humidity']
            fertilizing = match['fertilizing']
            print(f"  Species match: {plant_name} -> {plant_species or '(by name)'}", file=sys.stderr)
        else:
            unmatched += 1
            light = water = humidity = fertilizing = ''
            print(f"  No match: {plant_name}", file=sys.stderr)

        print(f"{light}\t{water}\t{humidity}\t{fertilizing}")

    print(file=sys.stderr)
    print(f"Summary: {matched_species} from species, {matched_notes} from notes, {unmatched} unmatched out of {len(plants)} plants",
          file=sys.stderr)


if __name__ == '__main__':
    main()
