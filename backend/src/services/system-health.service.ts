import { BlockList, isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { emitNotification } from './notification-delivery.service';

export function allowedHealthUrl(rawUrl: string, allowedHosts: string): URL | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const allowed = new Set(
      allowedHosts
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      isIP(host.replace(/^\[|\]$/g, '')) ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      !allowed.has(host)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

const privateNetworks = new BlockList();
for (const [base, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  privateNetworks.addSubnet(base, prefix, 'ipv4');
for (const [base, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  privateNetworks.addSubnet(base, prefix, 'ipv6');

export function isPublicHealthAddress(address: string): boolean {
  const family = isIP(address);
  return (
    family !== 0 &&
    !address.toLowerCase().startsWith('::ffff:') &&
    !privateNetworks.check(address, family === 4 ? 'ipv4' : 'ipv6')
  );
}

async function probeHttps(url: URL): Promise<number> {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((address) => !isPublicHealthAddress(address.address)))
    throw new Error('Health host resolved to a non-public address');
  const chosen = addresses[0]!;
  return new Promise<number>((resolve, reject) => {
    const probe = request(
      {
        hostname: chosen.address,
        servername: url.hostname,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        headers: { Host: url.host },
        signal: AbortSignal.timeout(8_000),
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
        response.on('error', reject);
      },
    );
    probe.on('error', reject);
    probe.end();
  });
}

async function checkSystem(system: {
  id: string;
  name: string;
  productionUrl: string | null;
  assignedEngineerId: string | null;
  project: { managerId: string | null };
}): Promise<boolean> {
  const url =
    system.productionUrl && allowedHealthUrl(system.productionUrl, env.HEALTH_PROBE_HOSTS ?? '');
  if (!url) return false;
  const previous = await prisma.systemHealthCheck.findFirst({
    where: { systemId: system.id },
    select: { status: true },
    orderBy: { checkedAt: 'desc' },
  });
  const start = performance.now();
  let status = 'DOWN';
  let httpStatus: number | null = null;
  let error: string | null = null;
  try {
    httpStatus = await probeHttps(url);
    status = httpStatus >= 200 && httpStatus < 300 ? 'UP' : 'DOWN';
  } catch {
    error = 'Probe connection failed or timed out';
  }
  const check = await prisma.systemHealthCheck.create({
    data: {
      systemId: system.id,
      status,
      httpStatus,
      responseMs: Math.round(performance.now() - start),
      error,
    },
  });
  if (previous?.status !== status) {
    const recipients = new Set(
      [system.project.managerId, system.assignedEngineerId].filter((id): id is string =>
        Boolean(id),
      ),
    );
    for (const userId of recipients) {
      try {
        await emitNotification({
          eventKey: 'system.health',
          userId,
          title: `${system.name} health is ${status.toLowerCase()}`,
          body: `${system.name} ${status === 'UP' ? 'responded successfully' : 'failed its HTTPS health check'}.`,
          dedupeKey: `system-health:${check.id}:${userId}`,
        });
      } catch (notifyError) {
        logger.error({ err: notifyError, systemId: system.id }, 'Health alert enqueue failed');
      }
    }
  }
  return true;
}

/** Only exact HTTPS hosts configured by operators may be probed. */
export async function scanSystemHealth(): Promise<number> {
  if (!env.HEALTH_PROBE_HOSTS?.trim()) return 0;
  const systems = await prisma.managedSystem.findMany({
    where: {
      deletedAt: null,
      maintenanceStatus: 'ACTIVE',
      productionUrl: { not: null },
      project: { deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      productionUrl: true,
      assignedEngineerId: true,
      project: { select: { managerId: true } },
    },
    take: 500,
  });
  let checked = 0;
  for (let index = 0; index < systems.length; index += 5) {
    const batch = await Promise.allSettled(systems.slice(index, index + 5).map(checkSystem));
    for (const result of batch) {
      if (result.status === 'fulfilled' && result.value) checked += 1;
      else if (result.status === 'rejected')
        logger.error({ err: result.reason }, 'System health probe failed');
    }
  }
  return checked;
}
