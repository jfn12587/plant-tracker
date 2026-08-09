#!/usr/bin/env python3
"""
Backfill care fields (Light, Water, Humidity, Fertilizing) for plants in the inventory
by matching them to species data from the vera_species.tsv file.

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
import sys

SPECIES_TSV = os.path.join(os.path.dirname(__file__), '..', '..', 'Vera', 'vera_species.tsv')
INVENTORY_CSV = os.path.join(os.path.dirname(__file__), '..', '..', 'Vera', 'inventory_with_ids.csv')


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


def match_species(plant_species, species_data):
    """Try to match a plant's species field to species data."""
    if not plant_species:
        return None
    key = plant_species.strip().lower()
    if key in species_data:
        return species_data[key]
    # Try partial match (species field might be scientific name or common name)
    for sp_key, sp_val in species_data.items():
        if key in sp_key or sp_key in key:
            return sp_val
    return None


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

    matched = 0
    unmatched = 0

    for plant in plants:
        plant_name = plant.get('Name', '')
        plant_species = plant.get('Species', '')

        match = match_species(plant_species, species_data)

        if match:
            matched += 1
            light = match['light']
            water = match['water']
            humidity = match['humidity']
            fertilizing = match['fertilizing']
            print(f"  Matched: {plant_name} -> {plant_species}", file=sys.stderr)
        else:
            unmatched += 1
            light = ''
            water = ''
            humidity = ''
            fertilizing = ''
            print(f"  No match: {plant_name} (species: '{plant_species}')", file=sys.stderr)

        # Output TSV row (escape tabs and newlines within cell values)
        # Google Sheets handles newlines within cells fine when pasting
        print(f"{light}\t{water}\t{humidity}\t{fertilizing}")

    print(file=sys.stderr)
    print(f"Summary: {matched} matched, {unmatched} unmatched out of {len(plants)} plants",
          file=sys.stderr)


if __name__ == '__main__':
    main()
