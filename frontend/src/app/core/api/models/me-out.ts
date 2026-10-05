import { MeCollection } from '../models/me-collection';
export interface MeOut {
    collections: Array<MeCollection>;
    email: (string | null);
    groups: Array<string>;
    is_admin: boolean;
    name: (string | null);
    sub: string;
    username: (string | null);
}
