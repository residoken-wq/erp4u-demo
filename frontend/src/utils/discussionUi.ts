/**
 * Discussion & Workspace UI utility helpers
 */

export function getWorkspaceTabKeys(hasProjects: boolean): string[] {
    return hasProjects ? ['tasks', 'discussions'] : ['tasks'];
}

export function isEditedLabel(item: { edited_at?: string | Date | null } | null | undefined): string | null {
    return item?.edited_at ? '(đã sửa)' : null;
}

export function isNewBadge(item: { is_new?: boolean } | null | undefined): boolean {
    return Boolean(item?.is_new);
}

export function canEditDiscussion(
    discussion: { creator_id?: number } | null | undefined,
    currentUser: { id?: number } | null | undefined,
): boolean {
    return Boolean(currentUser?.id && discussion?.creator_id === currentUser.id);
}

export function canEditComment(
    comment: { user_id?: number } | null | undefined,
    currentUser: { id?: number } | null | undefined,
): boolean {
    return Boolean(currentUser?.id && comment?.user_id === currentUser.id);
}
