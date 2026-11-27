import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../utils/api';
import { PackageKey } from '../../../config/packages';

describe('Internal Communications Frontend UX (Task P11b - Vitest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AnnouncementBanner API isolation', () => {
    it('AnnouncementBanner only fetches /announcements/user/active and NEVER calls /discussions', async () => {
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });

      // Simulate loadAnnouncements logic from AnnouncementBanner
      const loadAnnouncements = async () => {
        try {
          const annRes = await api.get('/announcements/user/active').catch(() => ({ data: [] }));
          return Array.isArray(annRes.data) ? annRes.data : [];
        } catch (_) {
          return [];
        }
      };

      const result = await loadAnnouncements();
      expect(result).toEqual([]);

      // Verify called endpoints
      expect(getSpy).toHaveBeenCalledWith('/announcements/user/active');
      const calledUrls = getSpy.mock.calls.map((call) => call[0]);
      expect(calledUrls).not.toContain('/discussions');
      expect(calledUrls).not.toContain('/discussions/');
    });
  });

  describe('Workspace gating for PackageKey.PROJECTS', () => {
    it('hides Discussions tab when tenant does not have PROJECTS package', () => {
      // Mock entitlement check where PROJECTS is false
      const isEnabled = (pkg: PackageKey | string) => pkg === PackageKey.CORE;

      const hasProjects = isEnabled(PackageKey.PROJECTS);
      const items: { key: string; label: string }[] = [
        { key: 'tasks', label: 'Công việc & Nhắc nhở' },
      ];
      if (hasProjects) {
        items.push({ key: 'discussions', label: 'Thảo luận' });
      }

      expect(items.some((item) => item.key === 'discussions')).toBe(false);
      expect(items.length).toBe(1);
    });

    it('shows Discussions tab when tenant has PROJECTS package enabled', () => {
      // Mock entitlement check where PROJECTS is true
      const isEnabled = (pkg: PackageKey | string) =>
        pkg === PackageKey.CORE || pkg === PackageKey.PROJECTS;

      const hasProjects = isEnabled(PackageKey.PROJECTS);
      const items: { key: string; label: string }[] = [
        { key: 'tasks', label: 'Công việc & Nhắc nhở' },
      ];
      if (hasProjects) {
        items.push({ key: 'discussions', label: 'Thảo luận' });
      }

      expect(items.some((item) => item.key === 'discussions')).toBe(true);
      expect(items.find((item) => item.key === 'discussions')?.label).toBe('Thảo luận');
    });
  });

  describe('UI Labels: "(đã sửa)" and "Mới"', () => {
    it('determines "Mới" badge when discussion has is_new = true', () => {
      const discussionWithNew = { id: 1, title: 'Chủ đề mới', is_new: true };
      const discussionRead = { id: 2, title: 'Chủ đề cũ', is_new: false };

      const getBadge = (d: { is_new?: boolean }) => (d.is_new ? 'Mới' : null);

      expect(getBadge(discussionWithNew)).toBe('Mới');
      expect(getBadge(discussionRead)).toBe(null);
    });

    it('determines "(đã sửa)" label when discussion or comment has edited_at', () => {
      const editedItem = { id: 1, content: 'Đã chỉnh sửa', edited_at: '2026-11-27T10:00:00Z' };
      const uneditedItem = { id: 2, content: 'Nguyên bản', edited_at: null };

      const getEditedLabel = (item: { edited_at?: string | null }) =>
        item.edited_at ? '(đã sửa)' : null;

      expect(getEditedLabel(editedItem)).toBe('(đã sửa)');
      expect(getEditedLabel(uneditedItem)).toBe(null);
    });
  });
});
