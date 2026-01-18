import { prisma } from '@trendsinusa/db';

import { runDiscoverySweep } from '../jobs/discoverySweep.js';
import { runUnaffiliatedPostGeneration } from '../jobs/unaffiliatedPosts.js';

type SupportedJobType = 'DISCOVERY_SWEEP' | 'UNAFFILIATED_PUBLISHER';

function isSupportedJobType(v: string): v is SupportedJobType {
  return v === 'DISCOVERY_SWEEP' || v === 'UNAFFILIATED_PUBLISHER';
}

type CronField = { any: true } | { values: Set<number> };

type CronSpec = {
  minute: CronField; // 0-59
  hour: CronField; // 0-23
  dayOfMonth: CronField; // 1-31
  month: CronField; // 1-12
  dayOfWeek: CronField; // 0-6 (Sun=0)
};

function parseCronField(field: string, min: number, max: number): CronField {
  const raw = field.trim();
  if (raw === '*') return { any: true };

  const out = new Set<number>();
  const parts = raw.split(',');
  for (const part0 of parts) {
    const part = part0.trim();
    if (!part) continue;

    // */n
    if (part.startsWith('*/')) {
      const step = Number(part.slice(2));
      if (!Number.isFinite(step) || step <= 0) throw new Error(`invalid_cron_step:${part}`);
      for (let v = min; v <= max; v += step) out.add(v);
      continue;
    }

    // a-b
    if (part.includes('-')) {
      const [aRaw, bRaw] = part.split('-', 2);
      const a = Number(aRaw);
      const b = Number(bRaw);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`invalid_cron_range:${part}`);
      const start = Math.max(min, Math.min(max, Math.trunc(a)));
      const end = Math.max(min, Math.min(max, Math.trunc(b)));
      for (let v = Math.min(start, end); v <= Math.max(start, end); v++) out.add(v);
      continue;
    }

    // single number
    const v = Number(part);
    if (!Number.isFinite(v)) throw new Error(`invalid_cron_value:${part}`);
    const n = Math.trunc(v);
    if (n < min || n > max) throw new Error(`cron_out_of_range:${part}`);
    out.add(n);
  }

  if (out.size === 0) throw new Error(`invalid_cron_empty:${field}`);
  return { values: out };
}

function parseCron(cron: string): CronSpec {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('invalid_cron:expected_5_fields');
  const min = parts[0]!;
  const hour = parts[1]!;
  const dom = parts[2]!;
  const mon = parts[3]!;
  const dow = parts[4]!;
  return {
    minute: parseCronField(min, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dayOfMonth: parseCronField(dom, 1, 31),
    month: parseCronField(mon, 1, 12),
    dayOfWeek: parseCronField(dow, 0, 6),
  };
}

function matchesField(field: CronField, v: number): boolean {
  return 'any' in field ? true : field.values.has(v);
}

function matchesCron(spec: CronSpec, d: Date): boolean {
  // UTC-only scheduling (fail-closed for other timezones at registration time).
  return (
    matchesField(spec.minute, d.getUTCMinutes()) &&
    matchesField(spec.hour, d.getUTCHours()) &&
    matchesField(spec.dayOfMonth, d.getUTCDate()) &&
    matchesField(spec.month, d.getUTCMonth() + 1) &&
    matchesField(spec.dayOfWeek, d.getUTCDay())
  );
}

function nextRunUtc(spec: CronSpec, afterUtc: Date): Date | null {
  // Find the next matching minute. Bound search to 31 days to avoid infinite loops.
  const start = new Date(afterUtc.getTime());
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  const maxSteps = 31 * 24 * 60;
  let cur = start;
  for (let i = 0; i < maxSteps; i++) {
    if (matchesCron(spec, cur)) return cur;
    cur = new Date(cur.getTime() + 60_000);
  }
  return null;
}

type ScheduleRow = {
  id: string;
  siteKey: string;
  jobType: string;
  enabled: boolean;
  cron: string;
  timezone: string;
};

class ScheduleTask {
  private timer: NodeJS.Timeout | null = null;
  private spec: CronSpec;
  private stopped = false;

  constructor(private row: ScheduleRow) {
    if (row.timezone !== 'UTC') throw new Error(`unsupported_timezone:${row.timezone}`);
    this.spec = parseCron(row.cron);
  }

  key() {
    return `${this.row.siteKey}::${this.row.jobType}`;
  }

  update(row: ScheduleRow) {
    this.row = row;
    if (row.timezone !== 'UTC') throw new Error(`unsupported_timezone:${row.timezone}`);
    this.spec = parseCron(row.cron);
    this.reschedule();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  start() {
    this.stopped = false;
    this.reschedule();
  }

  private reschedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.stopped) return;
    if (!this.row.enabled) return;

    const now = new Date();
    const next = nextRunUtc(this.spec, now);
    if (!next) {
      // eslint-disable-next-line no-console
      console.log('[scheduler] no_next_run', { scheduleId: this.row.id, siteKey: this.row.siteKey, jobType: this.row.jobType, cron: this.row.cron });
      return;
    }
    const delay = Math.max(0, next.getTime() - now.getTime());
    this.timer = setTimeout(async () => {
      try {
        await enqueueScheduledCommand(this.row);
      } finally {
        // always schedule the next occurrence
        this.reschedule();
      }
    }, delay);
  }
}

async function enqueueScheduledCommand(row: ScheduleRow) {
  if (!isSupportedJobType(row.jobType)) {
    // eslint-disable-next-line no-console
    console.log('[scheduler] unsupported_jobType', { jobType: row.jobType, scheduleId: row.id });
    return;
  }

  const now = new Date();

  async function logEvent(kind: 'scheduled_run_started' | 'scheduled_run_skipped' | 'scheduled_run_completed', details: Record<string, unknown>) {
    const msg = `${kind} jobType=${row.jobType} siteKey=${row.siteKey} scheduleId=${row.id} ${JSON.stringify(details)}`;
    await prisma.systemAlert
      .create({
        data: {
          type: 'SYSTEM',
          severity: 'INFO',
          message: msg,
          noisy: false,
        },
        select: { id: true },
      })
      .catch(() => null);
  }

  // De-dupe in-process scheduling races by atomically claiming this tick window.
  // (e.g. reconcile+timer edge cases near the minute boundary)
  const recentWindowMs = 30_000;
  const claimed = await prisma.automationSchedule
    .updateMany({
      where: {
        id: row.id,
        OR: [{ lastScheduledAt: null }, { lastScheduledAt: { lt: new Date(now.getTime() - recentWindowMs) } }],
      },
      data: { lastScheduledAt: now },
    })
    .catch(() => ({ count: 0 }));
  if (claimed.count === 0) {
    // eslint-disable-next-line no-console
    console.log('[scheduler] already_scheduled_recently', { siteKey: row.siteKey, jobType: row.jobType, scheduleId: row.id });
    return;
  }

  // Global automation gate (fail-closed).
  const cfg = await prisma.automationConfig.findUnique({ where: { siteKey: row.siteKey }, select: { automationEnabled: true } }).catch(() => null);
  if (!cfg?.automationEnabled) {
    // eslint-disable-next-line no-console
    console.log('[scheduler] skipped_automation_disabled', { siteKey: row.siteKey, jobType: row.jobType, scheduleId: row.id });
    const cmd = await prisma.systemCommand
      .create({
        data: {
          type: row.jobType as any,
          siteKey: row.siteKey,
          status: 'FAILURE',
          requestedAt: now,
          processedAt: now,
          error: 'automation_disabled',
          metadata: { scheduled: true, scheduleId: row.id, cron: row.cron, timezone: row.timezone, skipped: true, reason: 'automation_disabled' } as any,
        },
        select: { id: true },
      })
      .catch(() => null);
    await logEvent('scheduled_run_skipped', { reason: 'automation_disabled', commandId: cmd?.id ?? null });
    return;
  }

  if (row.jobType === 'UNAFFILIATED_PUBLISHER') {
    const gate = await prisma.automationGate.findUnique({ where: { siteKey: row.siteKey }, select: { unaffiliatedAutoPublishEnabled: true } }).catch(() => null);
    if (!gate?.unaffiliatedAutoPublishEnabled) {
      // eslint-disable-next-line no-console
      console.log('[scheduler] skipped_unaffiliated_gate_off', { siteKey: row.siteKey, scheduleId: row.id });
      const cmd = await prisma.systemCommand
        .create({
          data: {
            type: row.jobType as any,
            siteKey: row.siteKey,
            status: 'FAILURE',
            requestedAt: now,
            processedAt: now,
            error: 'unaffiliated_auto_publish_disabled',
            metadata: { scheduled: true, scheduleId: row.id, cron: row.cron, timezone: row.timezone, skipped: true, reason: 'unaffiliated_auto_publish_disabled' } as any,
          },
          select: { id: true },
        })
        .catch(() => null);
      await logEvent('scheduled_run_skipped', { reason: 'unaffiliated_auto_publish_disabled', commandId: cmd?.id ?? null });
      return;
    }
  }

  // Idempotency: don't enqueue if one is already running.
  const running = await prisma.systemCommand
    .findFirst({ where: { siteKey: row.siteKey, type: row.jobType as any, status: 'STARTED', processedAt: null }, select: { id: true } })
    .catch(() => null);
  if (running) {
    // eslint-disable-next-line no-console
    console.log('[scheduler] already_running', { siteKey: row.siteKey, jobType: row.jobType, runningId: running.id });
    const cmd = await prisma.systemCommand
      .create({
        data: {
          type: row.jobType as any,
          siteKey: row.siteKey,
          status: 'FAILURE',
          requestedAt: now,
          processedAt: now,
          error: 'already_running',
          metadata: { scheduled: true, scheduleId: row.id, cron: row.cron, timezone: row.timezone, skipped: true, reason: 'already_running', runningId: running.id } as any,
        },
        select: { id: true },
      })
      .catch(() => null);
    await logEvent('scheduled_run_skipped', { reason: 'already_running', runningId: running.id, commandId: cmd?.id ?? null });
    return;
  }

  const cmd = await prisma.systemCommand
    .create({
    data: {
      type: row.jobType as any,
      siteKey: row.siteKey,
      status: 'STARTED',
      requestedAt: now,
      metadata: { scheduled: true, scheduleId: row.id, cron: row.cron, timezone: row.timezone } as any,
    },
    select: { id: true },
  })
  .catch(() => null);

  // eslint-disable-next-line no-console
  console.log('[scheduler] enqueued', { siteKey: row.siteKey, jobType: row.jobType, scheduleId: row.id, commandId: cmd?.id ?? null });
  await logEvent('scheduled_run_started', { commandId: cmd?.id ?? null });
}

async function processPendingCommandsOnce(siteKey: string) {
  const now = new Date();

  const cfg = await prisma.automationConfig.findUnique({ where: { siteKey }, select: { automationEnabled: true } }).catch(() => null);
  if (!cfg?.automationEnabled) return { ok: true as const, skipped: true as const, reason: 'automation_disabled' };

  const pending = await prisma.systemCommand.findMany({
    where: { siteKey, status: 'STARTED', processedAt: null, type: { in: ['DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER'] as any } },
    orderBy: { requestedAt: 'asc' },
    take: 3,
  });

  for (const cmd of pending) {
    try {
      const isScheduled = Boolean((cmd.metadata as any)?.scheduled);
      if (cmd.type === 'UNAFFILIATED_PUBLISHER') {
        const gate = await prisma.automationGate.findUnique({ where: { siteKey }, select: { unaffiliatedAutoPublishEnabled: true } }).catch(() => null);
        if (!gate?.unaffiliatedAutoPublishEnabled) {
          await prisma.systemCommand.update({
            where: { id: cmd.id },
            data: { status: 'FAILURE', processedAt: now, error: 'unaffiliated_auto_publish_disabled' },
          });
          if (isScheduled) {
            await prisma.systemAlert
              .create({
                data: {
                  type: 'SYSTEM',
                  severity: 'INFO',
                  message: `scheduled_run_completed jobType=${cmd.type} siteKey=${siteKey} commandId=${cmd.id} ${JSON.stringify({
                    status: 'FAILURE',
                    reason: 'unaffiliated_auto_publish_disabled',
                  })}`,
                  noisy: false,
                },
                select: { id: true },
              })
              .catch(() => null);
          }
          continue;
        }
      }

      let result: unknown = null;
      if (cmd.type === 'DISCOVERY_SWEEP') {
        result = await runDiscoverySweep({ siteKey });
      } else if (cmd.type === 'UNAFFILIATED_PUBLISHER') {
        const capRaw = Number(process.env.UNAFFILIATED_POSTS_LIMIT ?? 10);
        const cap = Number.isFinite(capRaw) ? Math.max(1, Math.min(10, Math.trunc(capRaw))) : 10;
        result = await runUnaffiliatedPostGeneration({ limit: cap });
      }

      await prisma.systemCommand.update({
        where: { id: cmd.id },
        data: { status: 'SUCCESS', processedAt: now, metadata: { ...((cmd.metadata as any) ?? {}), result } as any },
      });

      if (isScheduled) {
        const r: any = result as any;
        const skipped = Boolean(r?.skipped);
        const reason = skipped ? String(r?.reason ?? 'skipped') : null;
        if (skipped) {
          await prisma.systemAlert
            .create({
              data: {
                type: 'SYSTEM',
                severity: 'INFO',
                message: `scheduled_run_skipped jobType=${cmd.type} siteKey=${siteKey} commandId=${cmd.id} ${JSON.stringify({ reason })}`,
                noisy: false,
              },
              select: { id: true },
            })
            .catch(() => null);
        }
        await prisma.systemAlert
          .create({
            data: {
              type: 'SYSTEM',
              severity: 'INFO',
              message: `scheduled_run_completed jobType=${cmd.type} siteKey=${siteKey} commandId=${cmd.id} ${JSON.stringify({
                status: 'SUCCESS',
                skipped,
                reason,
              })}`,
              noisy: false,
            },
            select: { id: true },
          })
          .catch(() => null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.systemCommand.update({ where: { id: cmd.id }, data: { status: 'FAILURE', processedAt: now, error: message } });

      const isScheduled = Boolean((cmd.metadata as any)?.scheduled);
      if (isScheduled) {
        await prisma.systemAlert
          .create({
            data: {
              type: 'SYSTEM',
              severity: 'ERROR',
              message: `scheduled_run_completed jobType=${cmd.type} siteKey=${siteKey} commandId=${cmd.id} ${JSON.stringify({ status: 'FAILURE', error: message })}`,
              noisy: false,
            },
            select: { id: true },
          })
          .catch(() => null);
      }
    }
  }

  return { ok: true as const, processed: pending.length };
}

export async function startAutomationScheduleRuntime(params?: {
  siteKey?: string;
  pollSeconds?: number;
  processEverySeconds?: number;
}) {
  const siteKey = params?.siteKey ?? process.env.SITE_KEY ?? 'trendsinusa';
  const pollMs = Math.max(5, Math.min(300, Math.trunc(params?.pollSeconds ?? 30))) * 1000;
  const processMs = Math.max(2, Math.min(60, Math.trunc(params?.processEverySeconds ?? 5))) * 1000;

  const tasks = new Map<string, ScheduleTask>();

  async function reconcile() {
    const enabled = await prisma.automationSchedule
      .findMany({
        where: { siteKey, enabled: true, jobType: { in: ['DISCOVERY_SWEEP', 'UNAFFILIATED_PUBLISHER'] as any } },
        select: { id: true, siteKey: true, jobType: true, enabled: true, cron: true, timezone: true },
      })
      .catch(() => [] as ScheduleRow[]);

    const nextKeys = new Set(enabled.map((r) => `${r.siteKey}::${r.jobType}`));

    // stop removed
    for (const [k, t] of tasks.entries()) {
      if (!nextKeys.has(k)) {
        t.stop();
        tasks.delete(k);
        // eslint-disable-next-line no-console
        console.log('[scheduler] removed', { key: k });
      }
    }

    // add/update
    for (const row of enabled) {
      const k = `${row.siteKey}::${row.jobType}`;
      const existing = tasks.get(k);
      try {
        if (!existing) {
          const t = new ScheduleTask(row);
          tasks.set(k, t);
          t.start();
          // eslint-disable-next-line no-console
          console.log('[scheduler] registered', { key: k, cron: row.cron, timezone: row.timezone });
        } else {
          // Always update; ScheduleTask handles re-parsing/rescheduling.
          existing.update(row);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[scheduler] invalid_schedule', { key: k, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // initial
  await reconcile();

  const reconcileInterval = setInterval(() => void reconcile(), pollMs);
  const processInterval = setInterval(() => void processPendingCommandsOnce(siteKey), processMs);

  return {
    stop() {
      clearInterval(reconcileInterval);
      clearInterval(processInterval);
      for (const t of tasks.values()) t.stop();
      tasks.clear();
    },
  };
}

