import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateBackoff,
  shouldFallbackToPolling,
  mergeNotificationItem,
  mergeNotificationLists,
  countUnreadNotifications,
  parseNotificationSseBuffer,
} from '../notificationStreamHelper.ts';
import type { NotificationItem } from '../notificationStreamHelper.ts';

describe('Notification Stream Helpers (Task P11c)', () => {
  describe('1. Backoff calculation (calculateBackoff)', () => {
    it('returns correct backoff delay for attempts 1 to 5+ with max 30s', () => {
      assert.strictEqual(calculateBackoff(0), 1000);
      assert.strictEqual(calculateBackoff(1), 1000); // 1s
      assert.strictEqual(calculateBackoff(2), 2000); // 2s
      assert.strictEqual(calculateBackoff(3), 5000); // 5s
      assert.strictEqual(calculateBackoff(4), 10000); // 10s
      assert.strictEqual(calculateBackoff(5), 30000); // 30s
      assert.strictEqual(calculateBackoff(10), 30000); // capped at 30s
    });
  });

  describe('2. Fallback to polling decision (shouldFallbackToPolling)', () => {
    it('returns false for < 3 errors and true for >= 3 errors', () => {
      assert.strictEqual(shouldFallbackToPolling(0), false);
      assert.strictEqual(shouldFallbackToPolling(1), false);
      assert.strictEqual(shouldFallbackToPolling(2), false);
      assert.strictEqual(shouldFallbackToPolling(3), true);
      assert.strictEqual(shouldFallbackToPolling(4), true);
      assert.strictEqual(shouldFallbackToPolling(10), true);
    });
  });

  describe('3. Deduplication and merging (mergeNotificationItem & mergeNotificationLists)', () => {
    const sampleItem1: NotificationItem = {
      id: 101,
      title: 'Đơn hàng mới',
      message: 'Có đơn hàng SO-001',
      type: 'INFO',
      is_read: false,
      created_at: '2026-11-27T10:00:00Z',
    };

    const sampleItem2: NotificationItem = {
      id: 102,
      title: 'Duyệt thanh toán',
      message: 'Thanh toán đã duyệt',
      type: 'SUCCESS',
      is_read: true,
      created_at: '2026-11-27T09:00:00Z',
    };

    it('prepends new item to the head of the list', () => {
      const merged = mergeNotificationItem([sampleItem2], sampleItem1);
      assert.strictEqual(merged.length, 2);
      assert.strictEqual(merged[0].id, 101);
      assert.strictEqual(merged[1].id, 102);
    });

    it('deduplicates when item with existing id is received', () => {
      const updatedItem1: NotificationItem = {
        ...sampleItem1,
        message: 'Đơn hàng SO-001 đã cập nhật',
      };
      const merged = mergeNotificationItem([sampleItem1, sampleItem2], updatedItem1);
      assert.strictEqual(merged.length, 2);
      assert.strictEqual(merged[0].id, 101);
      assert.strictEqual(merged[0].message, 'Đơn hàng SO-001 đã cập nhật');
      assert.strictEqual(merged[1].id, 102);
    });

    it('mergeNotificationLists merges incoming list with existing list without duplicates', () => {
      const item3: NotificationItem = {
        id: 103,
        title: 'Công việc mới',
        message: 'Giao việc mới',
        type: 'INFO',
        is_read: false,
        created_at: '2026-11-27T08:00:00Z',
      };
      const incoming = [sampleItem1, item3];
      const existing = [sampleItem1, sampleItem2];

      const merged = mergeNotificationLists(existing, incoming);
      assert.strictEqual(merged.length, 3);
      assert.deepStrictEqual(merged.map((n) => n.id), [101, 103, 102]);
    });

    it('respects maxLimit capacity', () => {
      const largeList: NotificationItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Thông báo ${i + 1}`,
        message: `Nội dung ${i + 1}`,
        type: 'INFO',
        is_read: true,
        created_at: '2026-11-27T00:00:00Z',
      }));

      const newItem: NotificationItem = {
        id: 999,
        title: 'Thông báo 999',
        message: 'Mới nhất',
        type: 'INFO',
        is_read: false,
        created_at: '2026-11-27T12:00:00Z',
      };

      const merged = mergeNotificationItem(largeList, newItem, 50);
      assert.strictEqual(merged.length, 50);
      assert.strictEqual(merged[0].id, 999);
    });
  });

  describe('4. Count unread notifications (countUnreadNotifications)', () => {
    it('correctly counts only unread notifications', () => {
      const items: NotificationItem[] = [
        { id: 1, title: 'A', message: 'a', type: 'INFO', is_read: false, created_at: '' },
        { id: 2, title: 'B', message: 'b', type: 'INFO', is_read: true, created_at: '' },
        { id: 3, title: 'C', message: 'c', type: 'INFO', is_read: false, created_at: '' },
      ];
      assert.strictEqual(countUnreadNotifications(items), 2);
    });

    it('returns 0 when all read or empty', () => {
      assert.strictEqual(countUnreadNotifications([]), 0);
      const items: NotificationItem[] = [
        { id: 1, title: 'A', message: 'a', type: 'INFO', is_read: true, created_at: '' },
      ];
      assert.strictEqual(countUnreadNotifications(items), 0);
    });
  });

  describe('5. SSE Buffer parser (parseNotificationSseBuffer)', () => {
    it('parses single SSE notification chunk', () => {
      const chunk = `data: {"id":1,"title":"Chào mừng","message":"Xin chào","type":"INFO","is_read":false,"created_at":"2026-11-27T10:00:00Z"}\n\n`;
      const { events, remaining } = parseNotificationSseBuffer(chunk);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].id, 1);
      assert.strictEqual(events[0].title, 'Chào mừng');
      assert.strictEqual(remaining, '');
    });

    it('ignores : ping heartbeat comments and parses following data', () => {
      const chunk = `: ping\n\n: ping\n\ndata: {"id":2,"title":"Cảnh báo","message":"Hết hạn","type":"WARNING","is_read":false,"created_at":"2026-11-27T10:05:00Z"}\n\n`;
      const { events, remaining } = parseNotificationSseBuffer(chunk);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].id, 2);
      assert.strictEqual(events[0].type, 'WARNING');
      assert.strictEqual(remaining, '');
    });

    it('handles multiple events in a single chunk', () => {
      const chunk = `data: {"id":1,"title":"T1","message":"M1","type":"INFO","is_read":false,"created_at":""}\n\ndata: {"id":2,"title":"T2","message":"M2","type":"INFO","is_read":false,"created_at":""}\n\n`;
      const { events, remaining } = parseNotificationSseBuffer(chunk);
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].id, 1);
      assert.strictEqual(events[1].id, 2);
      assert.strictEqual(remaining, '');
    });

    it('handles incomplete chunk split across reads', () => {
      const part1 = `data: {"id":10,"title":"Dang ve","message":"dang ve`;
      const res1 = parseNotificationSseBuffer(part1);
      assert.strictEqual(res1.events.length, 0);
      assert.strictEqual(res1.remaining, part1);

      const part2 = `${res1.remaining}","type":"INFO","is_read":false,"created_at":""}\n\n`;
      const res2 = parseNotificationSseBuffer(part2);
      assert.strictEqual(res2.events.length, 1);
      assert.strictEqual(res2.events[0].id, 10);
      assert.strictEqual(res2.events[0].message, 'dang ve');
      assert.strictEqual(res2.remaining, '');
    });
  });
});
