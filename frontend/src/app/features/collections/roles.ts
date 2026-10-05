export type CollectionRole = 'viewer' | 'editor' | 'owner' | 'admin';

const RANK: Record<string, number> = { viewer: 1, editor: 2, owner: 3, admin: 4 };

export function roleRank(role: string | null | undefined): number {
  return RANK[role ?? ''] ?? 0;
}

export function canEdit(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK['editor'];
}

export function canManage(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK['owner'];
}

export function roleName(role: string | null | undefined): string {
  switch (role) {
    case 'viewer':
      return $localize`:@@collections.roleName.viewer:viewer`;
    case 'editor':
      return $localize`:@@collections.roleName.editor:editor`;
    case 'owner':
      return $localize`:@@collections.roleName.owner:owner`;
    case 'admin':
      return $localize`:@@collections.roleName.admin:admin`;
    default:
      return role ?? '';
  }
}
