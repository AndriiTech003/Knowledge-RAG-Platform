import { GrantIn } from '../models/grant-in';
export interface CollectionCreate {
    chunking_profile?: 'default' | 'small' | 'large';
    description?: (string | null);
    embedding_model?: (string | null);
    grants?: Array<GrantIn>;
    name: string;
}
