import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWorkspaceTabKeys,
  resolveWorkspaceTab,
  isEditedLabel,
  isNewBadge,
  canEditDiscussion,
  canEditComment,
} from '../discussionUi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('discussionUi utilities & source scan', () => {
  describe('getWorkspaceTabKeys', () => {
    it('returns tasks only when hasProjects is false', () => {
      assert.deepEqual(getWorkspaceTabKeys(false), ['tasks']);
    });

    it('returns tasks and discussions when hasProjects is true', () => {
      assert.deepEqual(getWorkspaceTabKeys(true), ['tasks', 'discussions']);
    });
  });

  describe('resolveWorkspaceTab', () => {
    it('returns tab when valid and included in allowedTabs', () => {
      const allowed = getWorkspaceTabKeys(true); // ['tasks', 'discussions']
      assert.equal(resolveWorkspaceTab('discussions', allowed), 'discussions');
      assert.equal(resolveWorkspaceTab('tasks', allowed), 'tasks');
    });

    it('returns tasks when tab is invalid or not in allowedTabs', () => {
      const allowed = getWorkspaceTabKeys(true);
      assert.equal(resolveWorkspaceTab('invalid-tab', allowed), 'tasks');
      assert.equal(resolveWorkspaceTab(null, allowed), 'tasks');
      assert.equal(resolveWorkspaceTab(undefined, allowed), 'tasks');
      assert.equal(resolveWorkspaceTab('', allowed), 'tasks');
    });

    it('returns tasks when hasProjects is false even if discussions requested', () => {
      const allowed = getWorkspaceTabKeys(false); // ['tasks']
      assert.equal(resolveWorkspaceTab('discussions', allowed), 'tasks');
    });
  });

  describe('isNewBadge', () => {
    it('returns true when is_new is true', () => {
      assert.equal(isNewBadge({ is_new: true }), true);
    });

    it('returns false when is_new is false or undefined or null', () => {
      assert.equal(isNewBadge({ is_new: false }), false);
      assert.equal(isNewBadge({}), false);
      assert.equal(isNewBadge(null), false);
      assert.equal(isNewBadge(undefined), false);
    });
  });

  describe('isEditedLabel', () => {
    it('returns "(đã sửa)" when edited_at is provided', () => {
      assert.equal(isEditedLabel({ edited_at: '2026-11-27T10:00:00Z' }), '(đã sửa)');
    });

    it('returns null when edited_at is null or undefined', () => {
      assert.equal(isEditedLabel({ edited_at: null }), null);
      assert.equal(isEditedLabel({}), null);
      assert.equal(isEditedLabel(null), null);
    });
  });

  describe('canEditDiscussion & canEditComment', () => {
    it('allows edit only if current user id matches creator/author id', () => {
      assert.equal(canEditDiscussion({ creator_id: 10 }, { id: 10 }), true);
      assert.equal(canEditDiscussion({ creator_id: 10 }, { id: 20 }), false);
      assert.equal(canEditDiscussion({ creator_id: 10 }, null), false);

      assert.equal(canEditComment({ user_id: 10 }, { id: 10 }), true);
      assert.equal(canEditComment({ user_id: 10 }, { id: 20 }), false);
      assert.equal(canEditComment({ user_id: 10 }, null), false);
    });
  });

  describe('Source scan assertions', () => {
    const frontendSrc = path.resolve(__dirname, '../../');

    it('AnnouncementBanner.tsx does not contain /discussions', () => {
      const bannerPath = path.join(frontendSrc, 'components/common/AnnouncementBanner.tsx');
      const content = fs.readFileSync(bannerPath, 'utf8');
      assert.ok(
        !content.includes('/discussions'),
        'AnnouncementBanner.tsx must not call or reference /discussions',
      );
    });

    it('WorkSpacePage.tsx imports and uses getWorkspaceTabKeys', () => {
      const workspacePath = path.join(frontendSrc, 'pages/WorkSpacePage.tsx');
      const content = fs.readFileSync(workspacePath, 'utf8');
      assert.ok(
        content.includes('getWorkspaceTabKeys'),
        'WorkSpacePage.tsx must import and use getWorkspaceTabKeys',
      );
    });

    it('SalesComments.tsx does not attach paste listener to document or window', () => {
      const salesCommentsPath = path.join(frontendSrc, 'components/sales/SalesComments.tsx');
      const content = fs.readFileSync(salesCommentsPath, 'utf8');
      const hasDocPaste = /document\.addEventListener\(\s*['"]paste['"]/.test(content);
      const hasWinPaste = /window\.addEventListener\(\s*['"]paste['"]/.test(content);
      assert.ok(!hasDocPaste, 'SalesComments.tsx must not attach paste listener to document');
      assert.ok(!hasWinPaste, 'SalesComments.tsx must not attach paste listener to window');
    });
  });
});
