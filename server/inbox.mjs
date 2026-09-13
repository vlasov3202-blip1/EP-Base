import crypto from 'node:crypto';

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const now = () => new Date().toISOString();

export class UnifiedInboxService {
  constructor({ repo, audit, events, connectorRegistry, maxAttempts = 4, baseBackoffMs = 1000 }) {
    this.repo = repo;
    this.audit = audit;
    this.events = events;
    this.connectorRegistry = connectorRegistry;
    this.maxAttempts = maxAttempts;
    this.baseBackoffMs = baseBackoffMs;
  }

  normalizeInbound(channel, payload) {
    const externalMessageId = payload.externalMessageId || payload.messageId || payload.id;
    const conversationExternalId = payload.conversationExternalId || payload.conversationId || payload.chatId;
    if (!externalMessageId || !conversationExternalId) throw new Error('external ids required');
    return {
      id: crypto.randomUUID(),
      direction: 'inbound',
      channel,
      externalMessageId: String(externalMessageId),
      conversationExternalId: String(conversationExternalId),
      customerExternalId: String(payload.customerExternalId || payload.userId || payload.senderId || 'unknown'),
      text: String(payload.text || payload.body || ''),
      attachments: structuredClone(payload.attachments || []),
      receivedAt: payload.receivedAt || now(),
      dedupKey: hash(`${channel}:${externalMessageId}`),
      status: 'received'
    };
  }

  ingest(ctx, channel, payload) {
    const msg = this.normalizeInbound(channel, payload);
    const existing = this.repo.list(ctx, 'InboxMessage').find(x => x.dedupKey === msg.dedupKey);
    if (existing) return { duplicate: true, message: existing };
    const saved = this.repo.put(ctx, 'InboxMessage', msg);
    this.events.emit(ctx, 'inbox.message.received', { messageId: saved.id, channel });
    this.audit.write(ctx, { action: 'inbox.ingest', entity: 'InboxMessage', entityId: saved.id, meta: { channel } });
    return { duplicate: false, message: saved };
  }

  queueOutbound(ctx, { channel, conversationExternalId, text, attachments = [], clientRequestId }) {
    if (!clientRequestId) throw new Error('clientRequestId required for anti-double-send');
    const idempotencyKey = hash(`${ctx.companyId}:${channel}:${clientRequestId}`);
    const existing = this.repo.list(ctx, 'OutboundMessage').find(x => x.idempotencyKey === idempotencyKey);
    if (existing) return { duplicate: true, message: existing };
    const item = {
      id: crypto.randomUUID(), channel, conversationExternalId, text, attachments,
      clientRequestId, idempotencyKey, status: 'queued', attempts: 0,
      nextAttemptAt: now(), createdAt: now(), lastError: null, externalMessageId: null
    };
    const saved = this.repo.put(ctx, 'OutboundMessage', item);
    this.events.emit(ctx, 'inbox.outbound.queued', { messageId: saved.id, channel });
    return { duplicate: false, message: saved };
  }

  async deliverOne(ctx, messageId, clock = Date.now()) {
    const item = this.repo.get(ctx, 'OutboundMessage', messageId);
    if (!item) throw new Error('outbound message not found');
    if (item.status === 'sent') return item;
    if (new Date(item.nextAttemptAt).getTime() > clock) return item;
    const connector = this.connectorRegistry.get(item.channel);
    if (!connector) throw new Error(`connector not registered:${item.channel}`);
    try {
      const result = await connector.sendMessage(ctx, {
        conversationExternalId: item.conversationExternalId,
        text: item.text,
        attachments: item.attachments,
        idempotencyKey: item.idempotencyKey
      });
      const saved = this.repo.put(ctx, 'OutboundMessage', { ...item, status: 'sent', attempts: item.attempts + 1, sentAt: now(), externalMessageId: result.externalMessageId || null, lastError: null });
      this.audit.write(ctx, { action: 'inbox.send', entity: 'OutboundMessage', entityId: item.id, meta: { channel: item.channel } });
      this.events.emit(ctx, 'inbox.outbound.sent', { messageId: item.id, channel: item.channel });
      return saved;
    } catch (error) {
      const attempts = item.attempts + 1;
      const terminal = attempts >= this.maxAttempts;
      const delay = this.baseBackoffMs * (2 ** Math.max(0, attempts - 1));
      const saved = this.repo.put(ctx, 'OutboundMessage', {
        ...item,
        status: terminal ? 'failed' : 'retry',
        attempts,
        lastError: String(error?.message || error),
        nextAttemptAt: new Date(clock + delay).toISOString()
      });
      this.audit.write(ctx, { action: 'inbox.send_failed', entity: 'OutboundMessage', entityId: item.id, result: terminal ? 'failed' : 'retry', meta: { attempts, channel: item.channel } });
      this.events.emit(ctx, terminal ? 'inbox.outbound.failed' : 'inbox.outbound.retry', { messageId: item.id, attempts, channel: item.channel });
      return saved;
    }
  }

  async runDue(ctx, clock = Date.now()) {
    const due = this.repo.list(ctx, 'OutboundMessage').filter(x => ['queued','retry'].includes(x.status) && new Date(x.nextAttemptAt).getTime() <= clock);
    const result = [];
    for (const item of due) result.push(await this.deliverOne(ctx, item.id, clock));
    return result;
  }
}

export class ConnectorRegistry {
  #connectors = new Map();
  register(name, connector) {
    if (!name || !connector?.sendMessage) throw new Error('invalid connector');
    this.#connectors.set(name, connector); return this;
  }
  get(name) { return this.#connectors.get(name) || null; }
  list() { return [...this.#connectors.keys()]; }
}
