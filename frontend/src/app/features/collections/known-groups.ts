export const KNOWN_GROUPS = ['engineering', 'sales', 'finance', 'hr', 'kb-admins'];

export function filterGroups(query: string, groups: string[] = KNOWN_GROUPS): string[] {
  const q = query.trim().toLowerCase();
  return q ? groups.filter((g) => g.includes(q)) : groups;
}
