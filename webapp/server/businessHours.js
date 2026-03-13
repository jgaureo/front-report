import moment from 'moment-timezone';

/**
 * Calculates the number of working minutes between two dates based on a teammate's schedule.
 * @param {Date|string} startUtc
 * @param {Date|string} endUtc
 * @param {Object} schedule - { timezone, workDays, startHour, endHour }
 */
export function calculateBusinessMinutes(startUtc, endUtc, schedule) {
  if (!startUtc || !endUtc) return 0;
  
  const start = moment(startUtc);
  const end = moment(endUtc);
  
  if (end.isBefore(start)) return 0;

  // Default schedule: Mon-Fri, 08:00 - 17:00 PST
  const tz = schedule?.timezone || 'America/Los_Angeles';
  // 0=Sun, 1=Mon, ..., 6=Sat in moment.js
  const workDays = schedule?.workDays || [1, 2, 3, 4, 5]; 
  const startHourStr = schedule?.startHour || '08:00';
  const endHourStr = schedule?.endHour || '17:00';

  const [sH, sM] = startHourStr.split(':').map(Number);
  const [eH, eM] = endHourStr.split(':').map(Number);

  // Convert to specific timezone
  const current = start.clone().tz(tz);
  const endTz = end.clone().tz(tz);

  let minutes = 0;

  // Iterate day by day in the target timezone
  while (current.isBefore(endTz)) {
    // Check if current day is a workday
    const currentDay = current.day();
    if (workDays.includes(currentDay)) {
      const workStart = current.clone().hours(sH).minutes(sM || 0).seconds(0).milliseconds(0);
      const workEnd = current.clone().hours(eH).minutes(eM || 0).seconds(0).milliseconds(0);

      // If the defined work period for this day is valid
      if (workStart.isBefore(workEnd)) {
        // Find the overlap between [current, endTz] and [workStart, workEnd]
        const overlapStart = moment.max(current, workStart);
        const overlapEnd = moment.min(endTz, workEnd);

        if (overlapStart.isBefore(overlapEnd)) {
          minutes += overlapEnd.diff(overlapStart, 'minutes');
        }
      }
    }
    
    // Jump to midnight of the next day
    current.add(1, 'day').startOf('day');
  }

  return minutes;
}
