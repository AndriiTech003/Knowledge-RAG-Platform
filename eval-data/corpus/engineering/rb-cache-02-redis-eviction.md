# RB-CACHE-02: Redis Eviction Runbook

**Runbook ID:** RB-CACHE-02 · **Owner:** API Platform team · **Related:** RB-INC-01, RFC-0057

## Scope

This runbook covers high memory usage and key eviction on the Redis clusters used by Atlas:

| Cluster | Purpose | maxmemory-policy | Node type |
|---|---|---|---|
| `redis-cache` | Query result cache for dashboards | `allkeys-lru` | cache.r6g.large |
| `redis-sessions` | Web app sessions and CSRF tokens | `volatile-ttl` | cache.r6g.large |
| `redis-ratelimit` | Token buckets for API rate limiting (RFC-0057) | `noeviction` | cache.r6g.xlarge |

Evictions on `redis-cache` are normal and only a problem when they cause the hit rate to fall below 70%. Evictions on `redis-sessions` log users out and must be treated as customer-facing. `redis-ratelimit` must never evict: with `noeviction`, writes fail instead, and Envoy fails open (see RFC-0057).

## Alerts

- **RedisEvictionsHigh:** `evicted_keys` rate above 5,000 per minute for 10 minutes. Severity SEV3 for `redis-cache`, SEV2 for `redis-sessions`.
- **RedisMemoryHigh:** used memory above 85% of `maxmemory` for 15 minutes.
- **RedisRateLimitWriteErrors:** any OOM write errors on `redis-ratelimit`. Severity SEV2.

## Diagnosis

1. Open the Grafana dashboard "Redis / Overview" and select the cluster.
2. Check `used_memory`, `evicted_keys` and `keyspace_hits` / `keyspace_misses`.
3. Look for a sudden growth in key count. The usual culprits are:
   - a deploy that changed the cache key format (old and new keys coexist until TTL expiry);
   - a missing TTL on new keys (check with `redis-cli --bigkeys` and `OBJECT IDLETIME` on samples);
   - a single tenant generating very large dashboard results.

## Mitigation

1. If a recent deploy introduced new key formats, roll it back using the deployment tooling.
2. For keys without TTL, apply a TTL with the script `scripts/redis/backfill_ttl.py --cluster <name> --ttl 3600`.
3. If memory pressure is caused by organic growth, scale the node type up one size (for example from cache.r6g.large to cache.r6g.xlarge) through Terraform in the `infra-live` repository. Scaling causes a failover of each shard of about 30 seconds.
4. For `redis-sessions`, confirm the policy is still `volatile-ttl`; a policy drift to `allkeys-lru` can evict keys without TTL that the web app relies on.

## Never do this

- Never run `FLUSHALL` or `FLUSHDB` in production without explicit approval from the Incident Commander.
- Never change `maxmemory-policy` on `redis-ratelimit`.

## After the incident

Record the root cause in the postmortem (RB-INC-01) and, if keys lacked TTL, add a regression test that asserts a TTL is set.
