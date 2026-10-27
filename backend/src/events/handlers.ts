// Domain event handler registry (I8.0). Handlers run once per event in their own
// transaction; DomainEventHandling records completion so a replay is a no-op.
// Finance handlers are registered here from I8.7 onward.
import type { DomainEvent, Prisma } from '@prisma/client';

export interface DomainEventHandler {
  /** Stable identifier persisted in domain_event_handlings — never rename. */
  name: string;
  handle(tx: Prisma.TransactionClient, event: DomainEvent): Promise<void>;
}

export type DomainEventHandlerRegistry = Readonly<Record<string, readonly DomainEventHandler[]>>;

export const DOMAIN_EVENT_HANDLERS: DomainEventHandlerRegistry = {};
