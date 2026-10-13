import { logger } from './lib/logger';
import { processPendingNotificationEmails } from './services/notification-delivery.service';
import { scanSlaBreaches } from './services/sla-escalation.service';
import { scanSystemHealth } from './services/system-health.service';

export function startBackgroundJobs(unref = true): () => void {
  let notificationActive = false;
  let slaActive = false;
  let healthActive = false;
  async function notification(): Promise<void> {
    if (notificationActive) return;
    notificationActive = true;
    try {
      await processPendingNotificationEmails();
    } catch (error) {
      logger.error({ err: error }, 'Notification queue iteration failed');
    } finally {
      notificationActive = false;
    }
  }
  async function sla(): Promise<void> {
    if (slaActive) return;
    slaActive = true;
    try {
      await scanSlaBreaches();
    } catch (error) {
      logger.error({ err: error }, 'SLA scan failed');
    } finally {
      slaActive = false;
    }
  }
  async function health(): Promise<void> {
    if (healthActive) return;
    healthActive = true;
    try {
      await scanSystemHealth();
    } catch (error) {
      logger.error({ err: error }, 'System health scan failed');
    } finally {
      healthActive = false;
    }
  }
  const timers = [
    setInterval(() => void notification(), 30_000),
    setInterval(() => void sla(), 15 * 60_000),
    setInterval(() => void health(), 5 * 60_000),
  ];
  if (unref) timers.forEach((timer) => timer.unref());
  void notification();
  void sla();
  void health();
  return () => timers.forEach(clearInterval);
}
