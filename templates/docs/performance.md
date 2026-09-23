# Performance Guide

> **Applicability**: This template is designed for web applications with a
> browser-based frontend. Remove or adapt this file for non-web projects.
> See SETUP.md Step 1, Feature Flags.

Performance guidelines, optimization targets, profiling procedures, and performance budgets for [PROJECT_NAME].

## Performance Budget

| Metric | Target | Hard Limit | Measured By |
|--------|--------|-----------|-------------|
| Page load (initial) | < [TARGET_LOAD_TIME] | < [MAX_LOAD_TIME] | [MEASUREMENT_TOOL] |
| Time to Interactive | < [TARGET_TTI] | < [MAX_TTI] | Lighthouse |
| API response (p50) | < [TARGET_P50] | < [MAX_P50] | [APM_TOOL] |
| API response (p95) | < [TARGET_P95] | < [MAX_P95] | [APM_TOOL] |
| Bundle size (JS) | < [TARGET_BUNDLE_SIZE] | < [MAX_BUNDLE_SIZE] | Build output |
| Bundle size (CSS) | < [TARGET_CSS_SIZE] | < [MAX_CSS_SIZE] | Build output |
| Memory usage | < [TARGET_MEMORY] | < [MAX_MEMORY] | Runtime metrics |

## Core Web Vitals

<!-- Remove this section if the project has no web frontend -->

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5s - 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | < 200ms | 200ms - 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1 - 0.25 | > 0.25 |

**Project targets**: Achieve "Good" for all Core Web Vitals on [TARGET_DEVICE] (e.g., mobile 4G, desktop broadband).

## Profiling Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| [PROFILER_1] | [PURPOSE] | [USAGE_DESCRIPTION] |
| [PROFILER_2] | [PURPOSE] | [USAGE_DESCRIPTION] |
| Lighthouse | Web performance audit | `npx lighthouse [URL]` or Chrome DevTools |
| [PROFILER_3_OR_REMOVE] | [PURPOSE] | [USAGE_DESCRIPTION] |

<!-- TODO: Add project-specific profiling commands or scripts -->

## Optimization Targets

| Category | Optimization | Impact | Priority |
|----------|-------------|--------|----------|
| Network | Minimize API round-trips | Reduces latency | High |
| Network | Enable compression (gzip/brotli) | Reduces transfer size | High |
| Rendering | [RENDERING_OPTIMIZATION_1_OR_REMOVE] | [IMPACT] | [PRIORITY] |
| Rendering | [RENDERING_OPTIMIZATION_2_OR_REMOVE] | [IMPACT] | [PRIORITY] |
| Data | Paginate large result sets | Reduces memory and transfer | High |
| Data | Use database indexes for frequent queries | Reduces query time | High |
| Assets | Optimize images ([IMAGE_FORMAT]) | Reduces page weight | Medium |
| Assets | Lazy-load below-the-fold content | Improves initial load | Medium |
| Code | Tree-shake unused dependencies | Reduces bundle size | Medium |
| Code | Code-split by route [CODE_SPLIT_OR_REMOVE] | Improves initial load | Medium |

## Load Testing

### Setup

- **Tool**: [LOAD_TEST_TOOL] (e.g., k6, Artillery, Locust)
- **Scenarios location**: `[LOAD_TEST_DIR]`
- **Target environment**: [LOAD_TEST_ENVIRONMENT] (never run against production without approval)

### Benchmarks

| Scenario | Concurrent Users | Target RPS | Max Latency (p95) |
|----------|-----------------|-----------|-------------------|
| [SCENARIO_1] | [USERS] | [RPS] | [LATENCY] |
| [SCENARIO_2] | [USERS] | [RPS] | [LATENCY] |
| [SCENARIO_3_OR_REMOVE] | [USERS] | [RPS] | [LATENCY] |

### Running Load Tests

```bash
[LOAD_TEST_COMMAND]
```

Review results against the benchmarks table above. Investigate any regression exceeding 10% from baseline.

## Caching Strategy

| Layer | Cache Type | TTL | Invalidation |
|-------|-----------|-----|-------------|
| [CACHE_LAYER_1] | [TYPE] (e.g., in-memory, Redis) | [TTL] | [STRATEGY] |
| [CACHE_LAYER_2] | [TYPE] (e.g., CDN, browser) | [TTL] | [STRATEGY] |
| [CACHE_LAYER_3_OR_REMOVE] | [TYPE] | [TTL] | [STRATEGY] |

### Cache Guidelines

- Cache **read-heavy, write-infrequent** data
- Always define a TTL -- never cache indefinitely without invalidation
- Use cache-aside (lazy loading) pattern by default
- Log cache hit/miss ratios for monitoring
- Invalidate on write: clear relevant cache entries after data mutations

## Bundle Size Management

<!-- Remove this section if the project has no frontend bundle -->

- **Budget enforcement**: [BUNDLE_BUDGET_TOOL_OR_REMOVE] (e.g., bundlesize, size-limit)
- **Analysis command**: `[BUNDLE_ANALYZE_COMMAND]`
- **Review cadence**: Check bundle size on every pull request

### Size Reduction Checklist

- [ ] Remove unused dependencies (`[DEPCHECK_COMMAND]`)
- [ ] Replace heavy libraries with lighter alternatives where possible
- [ ] Use dynamic imports for routes and large components
- [ ] Verify tree-shaking is effective (no side-effect-laden imports)
- [ ] Compress static assets at build time

## Monitoring

Track performance metrics continuously in production:

| Metric | Alert Threshold | Dashboard |
|--------|----------------|-----------|
| API response time (p95) | > [ALERT_LATENCY] | [DASHBOARD_LINK] |
| Error rate | > [ALERT_ERROR_RATE]% | [DASHBOARD_LINK] |
| Memory usage | > [ALERT_MEMORY] | [DASHBOARD_LINK] |
| CPU usage | > [ALERT_CPU]% | [DASHBOARD_LINK] |

<!-- TODO: Link to your monitoring dashboard and alerting configuration -->

See also: `./runbook.md` for incident response when performance degrades.
