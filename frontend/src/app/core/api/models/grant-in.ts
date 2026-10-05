export interface GrantIn {
    principal_id: string;
    principal_type: 'group' | 'user';
    role: 'viewer' | 'editor' | 'owner';
}
