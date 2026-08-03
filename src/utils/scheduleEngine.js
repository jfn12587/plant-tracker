export function computeScheduleStatus(schedules, events, inventory) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plantMap = new Map();
  inventory.forEach((p) => plantMap.set(p.id, p));

  return schedules.map((sched) => {
    const matchingEvents = events
      .filter((e) => e.plantId === sched.plantId && e.eventType === sched.eventType)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const lastDoneEvent = matchingEvents.find((e) => e.outcome === 'Done');
    const lastDone = lastDoneEvent ? new Date(lastDoneEvent.timestamp) : null;

    let nextDue = null;

    if (!lastDone) {
      nextDue = null;
    } else {
      const eventsAfterLastDone = matchingEvents.filter(
        (e) => new Date(e.timestamp) > lastDone
      );

      if (eventsAfterLastDone.length > 0) {
        const mostRecent = eventsAfterLastDone[0];
        if (mostRecent.outcome === 'Snoozed') {
          nextDue = addDays(new Date(mostRecent.timestamp), 2);
        } else if (mostRecent.outcome === 'Skipped') {
          const skipCount = eventsAfterLastDone.filter(
            (e) => e.outcome === 'Skipped'
          ).length;
          nextDue = addDays(lastDone, sched.cadence * (1 + skipCount));
        } else {
          nextDue = addDays(lastDone, sched.cadence);
        }
      } else {
        nextDue = addDays(lastDone, sched.cadence);
      }
    }

    const daysOverdue = nextDue
      ? Math.floor((today - nextDue) / (1000 * 60 * 60 * 24))
      : Infinity;

    const plant = plantMap.get(sched.plantId);

    return {
      ...sched,
      lastDone,
      nextDue,
      daysOverdue,
      plant: plant || { id: sched.plantId, name: sched.plantId },
    };
  });
}

export function groupByPlant(scheduleStatuses) {
  const map = new Map();

  for (const status of scheduleStatuses) {
    const id = status.plant.id;
    if (!map.has(id)) {
      map.set(id, {
        plant: status.plant,
        schedules: [],
        maxOverdue: -Infinity,
      });
    }
    const entry = map.get(id);
    entry.schedules.push(status);
    if (status.daysOverdue > entry.maxOverdue) {
      entry.maxOverdue = status.daysOverdue;
      entry._dueEventType = status.eventType;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.maxOverdue - a.maxOverdue);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
