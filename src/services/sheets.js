import { CONFIG } from '../config.js';

const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`;

export async function fetchAllData(accessToken) {
  const ranges = [
    'Inventory!A:I',
    'Events!A:D',
    'Schedules!A:C',
    'Event Types!A:A',
    'Species!A:L',
  ];

  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const res = await fetch(`${BASE_URL}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Sheets API error: ${res.status}`);
  }

  const json = await res.json();
  const [inventoryRaw, eventsRaw, schedulesRaw, eventTypesRaw, speciesRaw] = json.valueRanges;

  return {
    inventory: parseInventory(inventoryRaw.values || []),
    events: parseEvents(eventsRaw.values || []),
    schedules: parseSchedules(schedulesRaw.values || []),
    eventTypes: parseEventTypes(eventTypesRaw.values || []),
    species: parseSpecies(speciesRaw.values || []),
  };
}

export async function appendEvent(accessToken, plantId, eventType, outcome, timestamp) {
  const ts = timestamp || new Date().toISOString();
  const res = await fetch(
    `${BASE_URL}/values/Events!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[plantId, ts, eventType, outcome]],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to append event: ${res.status}`);
  }

  return { plantId, timestamp: ts, eventType, outcome };
}

export async function appendRow(accessToken, sheetName, values) {
  const range = `${sheetName}!A:Z`;
  const res = await fetch(
    `${BASE_URL}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to append row to ${sheetName}: ${res.status}`);
  }

  return res.json();
}

export async function updateCell(accessToken, range, value) {
  const res = await fetch(
    `${BASE_URL}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [[value]] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update cell ${range}: ${res.status}`);
  }

  return res.json();
}

export async function updateRow(accessToken, range, values) {
  const res = await fetch(
    `${BASE_URL}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update row ${range}: ${res.status}`);
  }

  return res.json();
}

export async function getSheetMetadata(accessToken) {
  const res = await fetch(`${BASE_URL}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get sheet metadata: ${res.status}`);
  }

  const json = await res.json();
  const sheets = {};
  for (const sheet of json.sheets) {
    sheets[sheet.properties.title] = sheet.properties.sheetId;
  }
  return sheets;
}

export async function deleteRow(accessToken, sheetTabId, rowIndex) {
  const res = await fetch(`${BASE_URL}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetTabId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to delete row: ${res.status}`);
  }

  return res.json();
}

export async function deleteRows(accessToken, sheetTabId, rowIndices) {
  // Sort descending so deleting earlier rows doesn't shift later ones
  const sorted = [...rowIndices].sort((a, b) => b - a);
  const requests = sorted.map((idx) => ({
    deleteDimension: {
      range: {
        sheetId: sheetTabId,
        dimension: 'ROWS',
        startIndex: idx,
        endIndex: idx + 1,
      },
    },
  }));

  const res = await fetch(`${BASE_URL}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    throw new Error(`Failed to delete rows: ${res.status}`);
  }

  return res.json();
}

function parseInventory(rows) {
  if (rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map((row) => ({
    id: row[0] || '',
    name: row[1] || '',
    species: row[2] || '',
    caretaker: row[3] || '',
    location: row[4] || '',
    acquiredDate: row[5] || '',
    photo: row[6] || '',
    pot: row[7] || '',
    notes: row[8] || '',
  }));
}

function parseEvents(rows) {
  if (rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map((row) => ({
    plantId: row[0] || '',
    timestamp: row[1] || '',
    eventType: row[2] || '',
    outcome: row[3] || '',
  }));
}

function parseSchedules(rows) {
  if (rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map((row) => ({
    plantId: row[0] || '',
    cadence: parseInt(row[1], 10) || 0,
    eventType: row[2] || '',
  }));
}

function parseEventTypes(rows) {
  if (rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map((row) => row[0]).filter(Boolean);
}

function parseSpecies(rows) {
  if (rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map((row) => ({
    name: row[0] || '',
    scientificName: row[1] || '',
    family: row[2] || '',
    light: row[3] || '',
    water: row[4] || '',
    humidity: row[5] || '',
    temperature: row[6] || '',
    food: row[7] || '',
    toxicity: row[8] || '',
    petFriendly: row[9] || '',
    additionalCare: row[10] || '',
    commonIssues: row[11] || '',
  }));
}
