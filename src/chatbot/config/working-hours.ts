export interface DaySchedule {
  off: boolean;
  from?: string; // HH:mm
  to?: string;   // HH:mm
}

export interface WorkingHoursConfig {
  tz?: string;
  days: {
    mon: DaySchedule;
    tue: DaySchedule;
    wed: DaySchedule;
    thu: DaySchedule;
    fri: DaySchedule;
    sat: DaySchedule;
    sun: DaySchedule;
  };
  holiday_note?: string;
}

export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

export function isWithinWorkingHours(
  date: Date = new Date(),
  config?: WorkingHoursConfig,
): boolean {
  if (!config || !config.days) return false;

  const timeZone = config.tz || 'Asia/Ho_Chi_Minh';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  let weekday = '';
  let hour = '0';
  let minute = '0';

  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value.toLowerCase().slice(0, 3);
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
  }

  const daySchedule = config.days[weekday as keyof typeof config.days];
  if (!daySchedule || daySchedule.off) {
    return false;
  }

  if (!daySchedule.from || !daySchedule.to) {
    return false;
  }

  const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);
  const fromMinutes = parseTimeToMinutes(daySchedule.from);
  const toMinutes = parseTimeToMinutes(daySchedule.to);

  return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
}
