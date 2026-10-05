# RB-DB-07: Postgres Failover Runbook

**Runbook ID:** RB-DB-07 · **Owner:** Infrastructure team · **Last tested:** 18 March 2026 (game day) · **Related:** RB-INC-01, RFC-0051

## When to use this runbook

Use this runbook when the primary node of the Atlas metadata database cluster `pg-atlas-main` is unhealthy and Patroni has **not** completed an automatic failover within 2 minutes, or when a planned switchover is needed (for example for a minor version upgrade or a host replacement).

The cluster `pg-atlas-main` runs PostgreSQL 16 managed by Patroni, with 3 nodes per region (1 primary, 2 synchronous-capable replicas) and etcd as the distributed configuration store. Applications connect through PgBouncer on port 6432; never connect applications directly to port 5432.

## Before you start

1. Make sure an incident is declared if customers are affected (see RB-INC-01). A planned switchover needs a change ticket in Jira (project `CHG`) instead.
2. Join the incident channel and announce: "Starting RB-DB-07 on pg-atlas-main".
3. Open the Grafana dashboard "Postgres / pg-atlas-main".

## Step 1: Check cluster state

```
patronictl -c /etc/patroni/patroni.yml list pg-atlas-main
```

Note the current leader, the state of each replica and the `Lag in MB` column.

## Step 2: Choose a candidate

- The candidate must be in state `streaming`.
- The candidate's replication lag must be **below 50 MB**. Never promote a replica with lag of 50 MB or more without explicit approval from the Incident Commander, because recent writes would be lost.
- Prefer a replica in the same availability zone as the PgBouncer primary pool.

## Step 3: Execute the failover

For an unhealthy primary:

```
patronictl -c /etc/patroni/patroni.yml failover pg-atlas-main --candidate <node> --force
```

For a planned switchover:

```
patronictl -c /etc/patroni/patroni.yml switchover pg-atlas-main --candidate <node> --scheduled now
```

## Step 4: Reconnect clients

PgBouncer follows the leader automatically through the Patroni REST API within about 10 seconds. If connection errors persist after 60 seconds, run `RECONNECT` on each PgBouncer instance from the admin console (`psql -p 6432 pgbouncer`).

Expected write unavailability for a healthy failover is **under 45 seconds**.

## Step 5: Verify

- `patronictl list` shows the new leader and at least one streaming replica.
- Error rate on the Query API is back to baseline (below 0.5%).
- The synthetic check "metadata-write" is green in all regions.

## Step 6: Rebuild the old primary

Once the old primary host is reachable, reinitialise it as a replica:

```
patronictl -c /etc/patroni/patroni.yml reinit pg-atlas-main <old-node>
```

## Cross-region failover

If the entire region is unavailable, follow RFC-0051. The standby cluster is promoted with `patronictl ... --force` on the standby leader **only** after the Incident Commander and VP Engineering have approved the regional failover.

## Things not to do

- Do not run `pg_ctl promote` by hand on a Patroni-managed node.
- Do not delete the etcd keys for the cluster.
- Do not restart all PgBouncer instances at the same time.
