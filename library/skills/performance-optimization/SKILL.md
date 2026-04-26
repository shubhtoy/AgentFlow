---
name: performance-optimization
description: Measurement-driven performance optimization — profile before optimizing, identify common bottlenecks (N+1 queries, bundle size, memory leaks, re-renders), and track web vitals.
---

# Performance Optimization

## The Cardinal Rule

**Measure before you optimize.** Never guess where the bottleneck is. Profile, identify the hotspot, fix it, measure again. Optimization without measurement is superstition.

## Process

1. **Define the goal** — "Page load under 2s" or "API response under 200ms at p99." Without a target, you don't know when to stop.
2. **Measure the baseline** — Record current performance with real data under realistic conditions.
3. **Identify the bottleneck** — Profile to find the single biggest contributor to slowness.
4. **Fix the bottleneck** — Apply the smallest change that addresses it.
5. **Measure again** — Verify the improvement. If it didn't help, revert.
6. **Repeat** — Go back to step 3 until the goal is met.

## When NOT to Optimize

- The code is fast enough for its use case
- The code is not in a hot path (runs rarely or handles small data)
- You are in the prototyping phase — optimize after the design stabilizes
- The optimization makes the code significantly harder to understand
- You are optimizing based on intuition, not profiling data

## Common Bottlenecks

### N+1 Queries

The most common backend performance issue. A loop makes one query per iteration instead of batching.

```python
# BAD: N+1 — one query per user
users = db.query("SELECT * FROM users LIMIT 100")
for user in users:
    orders = db.query(f"SELECT * FROM orders WHERE user_id = {user.id}")
```

```python
# GOOD: Batch query
users = db.query("SELECT * FROM users LIMIT 100")
user_ids = [u.id for u in users]
orders = db.query("SELECT * FROM orders WHERE user_id IN (%s)", user_ids)
```

Detection: Enable query logging. If you see the same query pattern repeated 10+ times per request, you have an N+1.

### Unnecessary Re-renders (Frontend)

Components re-render when their props or state change. Unnecessary re-renders waste CPU and cause jank.

Common causes:
- Creating new objects/arrays in render: `style={{ color: 'red' }}` creates a new object every render
- Passing callbacks without memoization: `onClick={() => handleClick(id)}`
- Missing `key` props on list items
- Context providers with frequently changing values

Detection: Use React DevTools Profiler, Vue DevTools, or `console.count` in render functions.

Fixes:
- `React.memo` for pure components
- `useMemo` / `useCallback` for expensive computations and callbacks
- Split contexts to separate frequently-changing values from stable ones
- Virtualize long lists (render only visible items)

### Bundle Size (Frontend)

Large JavaScript bundles delay page load and interactivity.

Detection:
```bash
# Webpack
npx webpack-bundle-analyzer stats.json

# Vite
npx vite-bundle-visualizer
```

Common fixes:
- Code splitting: dynamic `import()` for routes and heavy components
- Tree shaking: use ES modules, avoid `import *`
- Replace heavy libraries: `moment` → `date-fns`, `lodash` → individual imports
- Lazy load below-the-fold content
- Compress with gzip/brotli

### Memory Leaks

Memory usage grows over time, eventually causing slowdowns or crashes.

Common causes:
- Event listeners not removed on cleanup
- Timers (`setInterval`) not cleared
- Closures holding references to large objects
- Growing caches without eviction
- Detached DOM nodes referenced by JavaScript

Detection:
- Browser DevTools → Memory tab → Heap snapshots (compare over time)
- Node.js: `--inspect` flag + Chrome DevTools, or `process.memoryUsage()`
- Look for monotonically increasing memory in monitoring dashboards

### Slow Database Queries

Detection: Enable slow query logging (queries over 100ms).

Common fixes:
- Add indexes for columns used in WHERE, JOIN, and ORDER BY
- Use `EXPLAIN ANALYZE` to understand query plans
- Avoid `SELECT *` — fetch only needed columns
- Use connection pooling
- Cache frequently-read, rarely-changed data
- Denormalize for read-heavy workloads (with care)

### Network Latency

Detection: Browser DevTools → Network tab. Look for waterfall patterns.

Common fixes:
- Reduce round trips: batch API calls, use GraphQL for multiple resources
- Use HTTP/2 or HTTP/3 for multiplexing
- Add caching headers (`Cache-Control`, `ETag`)
- Use a CDN for static assets
- Compress responses (gzip/brotli)
- Preconnect to known origins: `<link rel="preconnect" href="...">`

## Caching Strategy

### Cache Hierarchy

1. **Browser cache** — Static assets with long `Cache-Control` max-age + content hashing
2. **CDN cache** — Geographically distributed, reduces origin load
3. **Application cache** — In-memory (Redis, Memcached) for computed results
4. **Database cache** — Query result cache, materialized views

### Cache Invalidation

The two hard problems in computer science: cache invalidation and naming things.

Strategies:
- **TTL (Time-To-Live)** — Simple, eventual consistency. Good for data that can be stale briefly.
- **Event-driven invalidation** — Invalidate on write. Consistent but complex.
- **Cache-aside** — Application checks cache, falls back to DB, populates cache. Most common pattern.
- **Content hashing** — For static assets. Change the filename when content changes. Cache forever.

Rules:
- Always set a TTL, even if long — unbounded caches grow forever
- Monitor cache hit rates — below 80% means the cache is not helping
- Cache at the right granularity — too fine wastes memory, too coarse causes unnecessary invalidation

## Profiling Tools

### Backend

| Tool | Language | Use For |
|------|----------|---------|
| `cProfile` / `py-spy` | Python | CPU profiling |
| `async-profiler` | Java/JVM | CPU and allocation profiling |
| `pprof` | Go | CPU, memory, goroutine profiling |
| `perf` | Linux | System-level CPU profiling |
| `EXPLAIN ANALYZE` | SQL | Query plan analysis |

### Frontend

| Tool | Use For |
|------|---------|
| Chrome DevTools Performance | Runtime performance, paint, layout |
| Lighthouse | Overall page performance audit |
| React DevTools Profiler | Component render timing |
| webpack-bundle-analyzer | Bundle composition |
| Web Vitals extension | Core Web Vitals monitoring |

## Web Vitals Reference

### Core Web Vitals

| Metric | What It Measures | Good | Needs Improvement | Poor |
|--------|-----------------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | Loading performance | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | Responsiveness | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | Visual stability | ≤ 0.1 | ≤ 0.25 | > 0.25 |

### Improving LCP

- Optimize the largest image/text block above the fold
- Preload critical resources: `<link rel="preload">`
- Remove render-blocking CSS and JavaScript
- Use `fetchpriority="high"` on the LCP image

### Improving INP

- Break long tasks (>50ms) into smaller chunks
- Use `requestIdleCallback` for non-urgent work
- Minimize main thread work during interactions
- Debounce rapid input handlers

### Improving CLS

- Set explicit `width` and `height` on images and videos
- Reserve space for dynamic content (ads, embeds)
- Avoid inserting content above existing content
- Use `transform` animations instead of layout-triggering properties

## Optimization Checklist

- [ ] Performance goal is defined with specific metrics
- [ ] Baseline is measured under realistic conditions
- [ ] Bottleneck is identified through profiling, not guessing
- [ ] Fix addresses the identified bottleneck specifically
- [ ] Improvement is verified with measurement
- [ ] No regression in other metrics
- [ ] Code remains readable and maintainable
- [ ] Caching has TTL and invalidation strategy
- [ ] Database queries use appropriate indexes
- [ ] Frontend bundle is code-split and tree-shaken
