import { applyJobFilters } from './job-filters';
import { fetchPlatformFeedJobsResult, hydratePlatformJob } from './fetch-platform-html';
import { delay } from '../../shared/network/delay';
import {
    createFailedJobBatchResult,
    createNoopJobBatchResult,
    publishJobBatch,
    type JobBatchResult,
    type JobNotifier,
} from './job-batch-publisher';
import type { ExtensionStorage } from '../../shared/storage/extension-storage';
import type { JobRecord } from '../../entities/job/model';
import type { PlatformMonitoringAdapter } from '../../platforms/contracts';
import type { PlatformId } from '../../platforms/platform-ids';
import { getJobRecordKey, resolveJobPlatformId } from '../../entities/job/identity';
import { parseJobPostedAt } from '../../shared/parsing/arabic-date';

export const KHAMSAT_PUBLISH_FRESHNESS_HOURS = 48;
const KHAMSAT_PUBLISH_FRESHNESS_WINDOW_MS = KHAMSAT_PUBLISH_FRESHNESS_HOURS * 60 * 60 * 1000;

function classifyKhamsatFreshness(
    job: Readonly<JobRecord>,
    now: Date
): 'fresh' | 'stale' | 'retry' {
    const postedAt = parseJobPostedAt(job.postedAt);

    if (!postedAt) {
        return 'retry';
    }

    return postedAt.getTime() >= now.getTime() - KHAMSAT_PUBLISH_FRESHNESS_WINDOW_MS
        ? 'fresh'
        : 'stale';
}

export async function runPollingCycle(options: {
    storage: ExtensionStorage;
    notifyJobs: JobNotifier;
    reason: string;
    monitoring: readonly PlatformMonitoringAdapter[];
    playNotificationSound?: () => Promise<void>;
}): Promise<JobBatchResult> {
    const { storage, notifyJobs, reason, monitoring, playNotificationSound } = options;
    const snapshot = await storage.getSnapshot();
    const settings = snapshot.settings;
    const attemptedAt = new Date().toISOString();
    const monitoringErrors: Record<string, { message: string; failedAt: string }> = {};
    const lastHydrationTime = new Map<PlatformId, number>();

    if (settings.systemEnabled === false) {
        await storage.touchLastCheck(`${reason}:disabled`);
        return createNoopJobBatchResult('polling', snapshot.seenJobs.length, 'system-disabled');
    }

    const feedJobs = new Map<string, JobRecord>();
    const activeMonitoring = monitoring.filter(
        (adapter) => adapter.resolveFeeds(settings).length > 0
    );

    if (activeMonitoring.length === 0) {
        await storage.touchLastCheck(`${reason}:no-platforms`);
        await storage.patchRuntimeState({
            lastPollingReason: reason,
            lastMonitoringAttemptAt: attemptedAt,
            lastMonitoringErrors: {},
        });
        return createNoopJobBatchResult('polling', snapshot.seenJobs.length, 'no-platforms');
    }

    const successfulPlatforms = new Set<PlatformId>();

    for (const adapter of activeMonitoring) {
        for (const url of adapter.resolveFeeds(settings)) {
            const result = await fetchPlatformFeedJobsResult(adapter, url);

            if (result.kind !== 'success') {
                monitoringErrors[adapter.id] = {
                    message: `${adapter.displayName}: ${result.reason}`,
                    failedAt: attemptedAt,
                };
                continue;
            }

            successfulPlatforms.add(adapter.id);

            for (const job of result.jobs) {
                const jobWithPlatform = {
                    ...job,
                    platformId: job.platformId ?? adapter.id,
                } satisfies JobRecord;
                const jobKey = getJobRecordKey(jobWithPlatform);

                feedJobs.set(jobKey, {
                    ...feedJobs.get(jobKey),
                    ...jobWithPlatform,
                });
            }
        }
    }

    if (successfulPlatforms.size === 0) {
        await storage.patchRuntimeState({
            lastPollingReason: `${reason}:fetch-failed`,
            lastMonitoringAttemptAt: attemptedAt,
            lastMonitoringErrors: monitoringErrors,
        });
        return createFailedJobBatchResult(
            'polling',
            snapshot.seenJobs.length,
            'fetch-failed',
            monitoringErrors
        );
    }

    const monitoringById = new Map<PlatformId, PlatformMonitoringAdapter>(
        activeMonitoring.map((adapter) => [adapter.id, adapter])
    );
    const feedJobList = [...feedJobs.values()];
    const eligibleJobs = new Map(feedJobList.map((job) => [getJobRecordKey(job), job]));
    const staleKhamsatJobs: JobRecord[] = [];
    const unseenCandidates = await storage.getUnseenJobs(feedJobList);
    const freshnessNow = new Date(attemptedAt);

    for (const job of unseenCandidates) {
        if (resolveJobPlatformId(job) !== 'khamsat') {
            continue;
        }

        const jobKey = getJobRecordKey(job);
        const monitoringAdapter = monitoringById.get('khamsat');
        let hydrated = job;
        if (monitoringAdapter) {
            if (monitoringAdapter.hydrationDelayMs) {
                const last = lastHydrationTime.get('khamsat') ?? 0;
                const elapsed = Date.now() - last;
                if (elapsed < monitoringAdapter.hydrationDelayMs) {
                    await delay(monitoringAdapter.hydrationDelayMs - elapsed);
                }
            }
            hydrated = await hydratePlatformJob(monitoringAdapter, job);
            lastHydrationTime.set('khamsat', Date.now());
        }
        const freshness = classifyKhamsatFreshness(hydrated, freshnessNow);

        if (freshness === 'fresh') {
            eligibleJobs.set(jobKey, hydrated);
            continue;
        }

        eligibleJobs.delete(jobKey);

        if (freshness === 'stale') {
            staleKhamsatJobs.push(hydrated);
            continue;
        }

        monitoringErrors.khamsat = {
            message: `Khamsat: missing publish date after detail hydration for job ${job.id}.`,
            failedAt: attemptedAt,
        };
    }

    if (staleKhamsatJobs.length > 0) {
        await storage.rememberJobsWithoutStats(staleKhamsatJobs);
    }

    const ingested = await storage.ingestJobs([...eligibleJobs.values()]);
    await storage.patchRuntimeState({
        lastPollingReason: reason,
        lastMonitoringAttemptAt: attemptedAt,
        lastMonitoringSuccessAt: attemptedAt,
        lastMonitoringErrors: monitoringErrors,
    });

    const hydratedJobs: JobRecord[] = [];

    for (const job of ingested.newJobs) {
        const platformId = resolveJobPlatformId(job);
        const monitoringAdapter = monitoringById.get(platformId);
        let hydrated = job;

        if (platformId !== 'khamsat' && monitoringAdapter) {
            if (monitoringAdapter.hydrationDelayMs) {
                const last = lastHydrationTime.get(platformId) ?? 0;
                const elapsed = Date.now() - last;
                if (elapsed < monitoringAdapter.hydrationDelayMs) {
                    await delay(monitoringAdapter.hydrationDelayMs - elapsed);
                }
            }
            hydrated = await hydratePlatformJob(monitoringAdapter, job);
            lastHydrationTime.set(platformId, Date.now());
        }

        if (applyJobFilters(hydrated, settings)) {
            hydratedJobs.push(hydrated);
        }
    }

    if (hydratedJobs.length > 0) {
        await storage.mergeRecentJobs(hydratedJobs);
    }

    return publishJobBatch({
        source: 'polling',
        jobs: hydratedJobs,
        totalChecked: ingested.seenJobs.length,
        settings,
        notificationsEnabled: ingested.notificationsEnabled,
        notifyJobs,
        playNotificationSound,
    });
}
