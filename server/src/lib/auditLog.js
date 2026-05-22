import { auditLogContainer } from '../db.js';
import crypto from 'crypto';

export async function auditLog(fastify, { actor, action, target, outcome, metadata = {} }) {
  const doc = {
    id: crypto.randomUUID(),
    actor: actor || 'anonymous',
    action,
    target: target || null,
    outcome,
    metadata,
    timestamp: new Date().toISOString(),
  };
  try {
    await auditLogContainer.items.create(doc);
  } catch (err) {
    fastify.log.error({ err }, 'Failed to write audit log');
  }
}
