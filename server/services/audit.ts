import crypto from 'crypto';
import { pool } from '../db';

export function getClientIp(req: any): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1'
  );
}

/** Registro de auditoria gerado pelo servidor. */
export async function writeAudit(
  user: { id: string; name: string; role: string; departmentName?: string } | null,
  action: string,
  resourceId: string,
  resourceName: string,
  details: string,
  result: 'SUCCESS' | 'DENIED' | 'BLOCKED',
  ip = 'servidor',
  device = 'Painel Web'
) {
  const actor = user || { id: 'system', name: 'Sistema', role: 'SYSTEM', departmentName: 'Infraestrutura' };
  const logId = 'audit-' + crypto.randomBytes(8).toString('hex');
  const logHash = crypto.createHash('sha256').update(logId + actor.id + Date.now()).digest('hex');
  try {
    await pool.query(
      `INSERT INTO audit_logs (
        id, timestamp, user_id, user_name, role, department, action,
        resource_id, resource_name, details, ip_address, device_info, result, hash
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        logId,
        actor.id,
        actor.name,
        actor.role,
        actor.departmentName || 'Geral',
        action,
        resourceId,
        resourceName,
        details,
        ip,
        device,
        result,
        logHash,
      ]
    );
  } catch (e) {
    console.warn('[Audit Log Insert Warning]', e);
  }
}
