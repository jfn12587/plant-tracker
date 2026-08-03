import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  fetchAllData,
  appendEvent,
  appendRow,
  updateCell,
  updateRow,
  deleteRow,
  deleteRows,
  getSheetMetadata,
} from '../services/sheets.js';
import { uploadPhoto } from '../services/drive.js';
import { getCachedData, setCachedData } from '../services/cache.js';
import { computeScheduleStatus, groupByPlant } from '../utils/scheduleEngine.js';

export function useSheetsData(accessToken) {
  const [raw, setRaw] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');

  useEffect(() => {
    const cached = getCachedData();
    if (cached?.data) {
      setRaw(cached.data);
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    refresh();
  }, [accessToken]);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setSyncStatus('syncing');
    try {
      const data = await fetchAllData(accessToken);
      setRaw(data);
      setCachedData(data);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Fetch failed:', err);
      setSyncStatus('error');
    }
  }, [accessToken]);

  const logEvent = useCallback(
    async (plantId, eventType, outcome, timestamp) => {
      if (!accessToken || !raw) return;

      const ts = timestamp || new Date().toISOString();
      const newEvent = { plantId, timestamp: ts, eventType, outcome };
      setRaw((prev) => ({
        ...prev,
        events: [...prev.events, newEvent],
      }));

      try {
        await appendEvent(accessToken, plantId, eventType, outcome, timestamp);
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to log event:', err);
        setSyncStatus('error');
      }
    },
    [accessToken, raw]
  );

  const updatePlantPhoto = useCallback(
    async (plantId, fileId) => {
      if (!accessToken || !raw) return;
      const rowIndex = raw.inventory.findIndex((p) => p.id === plantId);
      if (rowIndex === -1) return;
      const sheetRow = rowIndex + 2;
      const range = `Inventory!G${sheetRow}`; // Photo is now column G (was F before ID added)
      await updateCell(accessToken, range, fileId);

      setRaw((prev) => ({
        ...prev,
        inventory: prev.inventory.map((p) =>
          p.id === plantId ? { ...p, photo: fileId } : p
        ),
      }));
      setSyncStatus('synced');
    },
    [accessToken, raw]
  );

  const uploadPlantPhoto = useCallback(
    async (plantId, file) => {
      if (!accessToken || !raw) return;
      setSyncStatus('syncing');
      try {
        const plant = raw.inventory.find((p) => p.id === plantId);
        const fileId = await uploadPhoto(accessToken, file, plant?.name || plantId);
        await updatePlantPhoto(plantId, fileId);
        return fileId;
      } catch (err) {
        console.error('Photo upload failed:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, raw, updatePlantPhoto]
  );

  const nextPlantId = useCallback(() => {
    if (!raw) return 'P001';
    const maxNum = raw.inventory.reduce((max, p) => {
      const num = parseInt(p.id?.replace('P', ''), 10) || 0;
      return num > max ? num : max;
    }, 0);
    return `P${String(maxNum + 1).padStart(3, '0')}`;
  }, [raw]);

  const addPlant = useCallback(
    async (plantData) => {
      if (!accessToken) return;
      setSyncStatus('syncing');
      try {
        const id = nextPlantId();
        const values = [
          id,
          plantData.name,
          plantData.species || '',
          plantData.caretaker || '',
          plantData.location || '',
          plantData.acquiredDate || '',
          '', // photo
          plantData.pot || '',
          plantData.notes || '',
        ];
        await appendRow(accessToken, 'Inventory', values);

        const newPlant = {
          id,
          name: plantData.name,
          species: plantData.species || '',
          caretaker: plantData.caretaker || '',
          location: plantData.location || '',
          acquiredDate: plantData.acquiredDate || '',
          photo: '',
          pot: plantData.pot || '',
          notes: plantData.notes || '',
        };
        setRaw((prev) => ({
          ...prev,
          inventory: [...prev.inventory, newPlant],
        }));
        setSyncStatus('synced');
        return newPlant;
      } catch (err) {
        console.error('Failed to add plant:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, nextPlantId]
  );

  const updatePlant = useCallback(
    async (plantId, updates) => {
      if (!accessToken || !raw) return;
      setSyncStatus('syncing');
      try {
        const rowIndex = raw.inventory.findIndex((p) => p.id === plantId);
        if (rowIndex === -1) return;
        const sheetRow = rowIndex + 2;
        const existing = raw.inventory[rowIndex];
        const updated = { ...existing, ...updates };
        const values = [
          updated.id,
          updated.name,
          updated.species,
          updated.caretaker,
          updated.location,
          updated.acquiredDate,
          updated.photo,
          updated.pot,
          updated.notes,
        ];
        const range = `Inventory!A${sheetRow}:I${sheetRow}`;
        await updateRow(accessToken, range, values);

        setRaw((prev) => ({
          ...prev,
          inventory: prev.inventory.map((p) =>
            p.id === plantId ? { ...p, ...updates } : p
          ),
        }));
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to update plant:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, raw]
  );

  const removePlant = useCallback(
    async (plantId) => {
      if (!accessToken || !raw) return;
      setSyncStatus('syncing');
      try {
        const sheetMeta = await getSheetMetadata(accessToken);
        const inventoryTabId = sheetMeta['Inventory'];
        const schedulesTabId = sheetMeta['Schedules'];

        const invIndex = raw.inventory.findIndex((p) => p.id === plantId);
        if (invIndex !== -1) {
          await deleteRow(accessToken, inventoryTabId, invIndex + 1);
        }

        const schedIndices = [];
        raw.schedules.forEach((s, i) => {
          if (s.plantId === plantId) {
            schedIndices.push(i + 1);
          }
        });
        if (schedIndices.length > 0) {
          await deleteRows(accessToken, schedulesTabId, schedIndices);
        }

        setRaw((prev) => ({
          ...prev,
          inventory: prev.inventory.filter((p) => p.id !== plantId),
          schedules: prev.schedules.filter((s) => s.plantId !== plantId),
        }));
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to remove plant:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, raw]
  );

  const addSchedule = useCallback(
    async (plantId, cadence, eventType) => {
      if (!accessToken) return;
      setSyncStatus('syncing');
      try {
        await appendRow(accessToken, 'Schedules', [plantId, cadence, eventType]);
        setRaw((prev) => ({
          ...prev,
          schedules: [...prev.schedules, { plantId, cadence: parseInt(cadence, 10), eventType }],
        }));
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to add schedule:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken]
  );

  const updateSchedule = useCallback(
    async (plantId, eventType, newCadence) => {
      if (!accessToken || !raw) return;
      setSyncStatus('syncing');
      try {
        const rowIndex = raw.schedules.findIndex(
          (s) => s.plantId === plantId && s.eventType === eventType
        );
        if (rowIndex === -1) return;
        const sheetRow = rowIndex + 2;
        const range = `Schedules!A${sheetRow}:C${sheetRow}`;
        await updateRow(accessToken, range, [plantId, newCadence, eventType]);

        setRaw((prev) => ({
          ...prev,
          schedules: prev.schedules.map((s) =>
            s.plantId === plantId && s.eventType === eventType
              ? { ...s, cadence: parseInt(newCadence, 10) }
              : s
          ),
        }));
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to update schedule:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, raw]
  );

  const removeSchedule = useCallback(
    async (plantId, eventType) => {
      if (!accessToken || !raw) return;
      setSyncStatus('syncing');
      try {
        const sheetMeta = await getSheetMetadata(accessToken);
        const schedulesTabId = sheetMeta['Schedules'];
        const rowIndex = raw.schedules.findIndex(
          (s) => s.plantId === plantId && s.eventType === eventType
        );
        if (rowIndex === -1) return;
        await deleteRow(accessToken, schedulesTabId, rowIndex + 1);

        setRaw((prev) => ({
          ...prev,
          schedules: prev.schedules.filter(
            (s) => !(s.plantId === plantId && s.eventType === eventType)
          ),
        }));
        setSyncStatus('synced');
      } catch (err) {
        console.error('Failed to remove schedule:', err);
        setSyncStatus('error');
        throw err;
      }
    },
    [accessToken, raw]
  );

  const computed = raw
    ? {
        ...raw,
        scheduleStatuses: computeScheduleStatus(raw.schedules, raw.events, raw.inventory),
        plantsByUrgency: groupByPlant(
          computeScheduleStatus(raw.schedules, raw.events, raw.inventory)
        ),
      }
    : null;

  return {
    ...computed,
    syncStatus,
    refresh,
    logEvent,
    addPlant,
    updatePlant,
    removePlant,
    addSchedule,
    updateSchedule,
    removeSchedule,
    uploadPlantPhoto,
    updatePlantPhoto,
    isLoading: !raw,
  };
}
