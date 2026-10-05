import { ClusterQuestion } from '../models/cluster-question';
export interface UnansweredCluster {
    count: number;
    id: string;
    label: (string | null);
    last_seen: string;
    questions: Array<ClusterQuestion>;
    users: number;
}
