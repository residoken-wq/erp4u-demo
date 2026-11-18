import { isWithinWorkingHours, WorkingHoursConfig, parseTimeToMinutes } from '../config/working-hours';

describe('Working Hours (CB0-17)', () => {
  const testConfig: WorkingHoursConfig = {
    tz: 'Asia/Ho_Chi_Minh',
    days: {
      mon: { off: false, from: '08:00', to: '17:30' },
      tue: { off: false, from: '08:00', to: '17:30' },
      wed: { off: false, from: '08:00', to: '17:30' },
      thu: { off: false, from: '08:00', to: '17:30' },
      fri: { off: false, from: '08:00', to: '17:30' },
      sat: { off: false, from: '08:00', to: '12:00' },
      sun: { off: true, from: '08:00', to: '17:30' },
    },
    holiday_note: 'Tết Nguyên Đán',
  };

  it('correctly parses HH:mm to minutes', () => {
    expect(parseTimeToMinutes('08:00')).toBe(480);
    expect(parseTimeToMinutes('17:30')).toBe(1050);
    expect(parseTimeToMinutes('')).toBe(0);
  });

  describe('Vietnam boundary tests with UTC environment simulation', () => {
    const originalTZ = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = 'UTC';
    });

    afterAll(() => {
      process.env.TZ = originalTZ;
    });

    // 2026-09-28 is a Monday
    // In UTC, VN 07:59 is 00:59 UTC
    it('Monday 07:59 VN is outside working hours (false)', () => {
      const date = new Date('2026-09-28T00:59:00.000Z');
      expect(isWithinWorkingHours(date, testConfig)).toBe(false);
    });

    // In UTC, VN 08:00 is 01:00 UTC
    it('Monday 08:00 VN is inside working hours (true)', () => {
      const date = new Date('2026-09-28T01:00:00.000Z');
      expect(isWithinWorkingHours(date, testConfig)).toBe(true);
    });

    // In UTC, VN 17:29 is 10:29 UTC
    it('Monday 17:29 VN is inside working hours (true)', () => {
      const date = new Date('2026-09-28T10:29:00.000Z');
      expect(isWithinWorkingHours(date, testConfig)).toBe(true);
    });

    // In UTC, VN 17:30 is 10:30 UTC
    it('Monday 17:30 VN is outside working hours (false)', () => {
      const date = new Date('2026-09-28T10:30:00.000Z');
      expect(isWithinWorkingHours(date, testConfig)).toBe(false);
    });

    // 2026-09-27 is a Sunday (off)
    it('Sunday is off (false at any hour)', () => {
      const sundayNoon = new Date('2026-09-27T05:00:00.000Z'); // 12:00 VN
      expect(isWithinWorkingHours(sundayNoon, testConfig)).toBe(false);
    });
  });
});
