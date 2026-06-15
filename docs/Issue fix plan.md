# Fix Rate Limiting (429 Too Many Requests) During Monitoring

This plan outlines the approach to resolve the `429 Too Many Requests` error from Mostaql and other platforms. The error occurs because the extension's background monitoring performs rapid, sequential `fetch` requests for every newly discovered job to extract deeper project details (hydration), often running every minute.

To prevent this without disabling hydration, we will introduce rate-limiting on a per-platform basis.

## User Review Required

> [!WARNING]
> This change will increase the minimum polling interval from 1 minute to 3 minutes to reduce overall background load. Is this acceptable, or would you prefer a different minimum interval (e.g., 2 minutes or 5 minutes)?

## Open Questions

> [!IMPORTANT]
> The plan suggests the following inter-request delays during job hydration:
> - **Mostaql**: 3000ms (3 seconds)
> - **Khamsat**: 2000ms (2 seconds)
> - **Nafezly**: 1000ms (1 second)
> 
> Are these delays acceptable for each platform, or do you have specific values in mind?

## Proposed Changes

We will modify the core monitoring and platform contracts to enforce a delay between job detail fetches.

### Platform Contracts & Settings

#### [MODIFY] `src/platforms/contracts.ts`
- Add an optional `hydrationDelayMs?: number` property to the `PlatformMonitoringAdapter` interface. This allows each platform to dictate its own rate limit.

#### [MODIFY] `src/entities/settings/model.ts`
- Change `DEFAULT_POLLING_INTERVAL` from `1` to `3`.
- Change `MIN_POLLING_INTERVAL` from `1` to `3`.
- This ensures the background worker does not spam the feed endpoints at an aggressive baseline rate.

---

### Platform Adapters

We will update each platform's monitoring adapter to specify its required delay, addressing the requirement to treat each platform on its own.

#### [MODIFY] `src/platforms/mostaql/monitoring.ts`
- Set `hydrationDelayMs: 3000` to prevent Mostaql/Cloudflare from issuing a 429 error during heavy bursts.

#### [MODIFY] `src/platforms/khamsat/monitoring.ts`
- Set `hydrationDelayMs: 2000` as a conservative limit.

#### [MODIFY] `src/platforms/nafezly/monitoring.ts`
- Set `hydrationDelayMs: 1000` since Nafezly might have less aggressive rate limits, but still benefits from throttling.

---

### Monitoring Engine

#### [NEW] `src/shared/network/delay.ts`
- Create a reusable `delay(ms: number): Promise<void>` utility function.

#### [MODIFY] `src/features/monitoring/run-polling-cycle.ts`
- Track the `lastHydrationTime` per platform within the polling cycle.
- In both the **Khamsat freshness loop** and the **new jobs loop**, check if `hydrationDelayMs` is defined for the adapter.
- If defined, calculate the time elapsed since the last request to that platform. If it's less than `hydrationDelayMs`, use the `delay` utility to wait the remaining time before calling `hydratePlatformJob`.
- Update the `lastHydrationTime` for the platform after the request completes.

## Verification Plan

### Automated Tests
- Run `npm test` to ensure the Vitest suite passes. The unit tests for monitoring and settings parsing might need to be adjusted if they explicitly assert `DEFAULT_POLLING_INTERVAL === 1`.

### Manual Verification
- Launch the Chrome development build (`npm run dev:chrome`).
- Reset the extension settings to default to apply the new 3-minute interval.
- Clear stored jobs so the next poll triggers multiple hydrations.
- Monitor the background service worker network tab.
- Verify that `https://mostaql.com/projects/<id>` fetches occur sequentially with a visible 3-second gap between them.
- Verify that no `429 Too Many Requests` errors appear.
