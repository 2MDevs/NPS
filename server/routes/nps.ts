import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth, requireRole } from '../auth/middleware';
import { writeAudit, getClientIp } from '../services/audit';
import { broadcastChange } from '../services/realtime';
import { sendSurveyInviteEmail } from '../mailer';
import {
  SURVEY,
  allQuestions,
  computeNps,
  npsCategory,
  questionNumbers,
  satisfactionAverage,
  validateAnswers,
  Answers,
} from '../../shared/survey';

/**
 * NPS de Franqueado
 * - Área da diretoria (/api/nps/*): só DIRETOR e DESENVOLVEDOR.
 * - Formulário público (/api/public/nps/:token): o franqueado abre o link individual, sem login, e responde uma vez.
 */
export const npsRouter = Router();
export const publicNpsRouter = Router();

const DIRECTORS = ['DIRECTOR', 'DEVELOPER'];
const actor = (req: Request) => {
  const u = (req as any).user;
  return { id: u.id, name: u.name, role: u.role, departmentName: u.departmentName };
};

const newId = (p: string) => `${p}-${crypto.randomBytes(8).toString('hex')}`;
const newToken = () => crypto.randomBytes(24).toString('base64url');
const dateOnly = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null);

export function publicBaseUrl(req: Request): string {
  const env = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (env && !env.includes('seu-dominio')) return env;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  return `${proto}://${req.get('host')}`;
}
const surveyLink = (req: Request, token: string) => `${publicBaseUrl(req)}/pesquisa/${token}`;

function toInviteDto(r: any, req: Request) {
  return {
    id: r.id,
    surveyId: r.survey_id,
    unitName: r.unit_name,
    cityUf: r.city_uf,
    inaugurationDate: dateOnly(r.inauguration_date),
    franchiseeName: r.franchisee_name,
    franchiseeEmail: r.franchisee_email,
    franchiseePhone: r.franchisee_phone,
    status: r.status as 'pending' | 'answered' | 'canceled',
    createdBy: r.created_by_name,
    createdAt: r.created_at,
    openedAt: r.opened_at,
    answeredAt: r.answered_at,
    canceledAt: r.canceled_at,
    link: r.status === 'pending' ? surveyLink(req, r.token) : null,
    npsScore: r.nps_score ?? null,
    npsCategory: r.nps_category ?? null,
    satisfactionAvg: r.satisfaction_avg !== null && r.satisfaction_avg !== undefined ? Number(r.satisfaction_avg) : null,
    needsAction: r.needs_action ?? null,
    treated: Boolean(r.treated_at),
  };
}

const INVITE_SELECT = `
  SELECT i.*, r.nps_score, r.nps_category, r.satisfaction_avg, r.needs_action, r.treated_at
    FROM nps_invites i LEFT JOIN nps_responses r ON r.invite_id = i.id`;

const InviteSchema = z.object({
  unitName: z.string().trim().min(2, 'Informe o nome da unidade.').max(255),
  cityUf: z.string().trim().max(255).optional().or(z.literal('')),
  inaugurationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da inauguração inválida.')
    .optional()
    .or(z.literal('')),
  franchiseeName: z.string().trim().min(2, 'Informe o nome do franqueado.').max(255),
  franchiseeEmail: z.string().trim().email('E-mail inválido.').max(255).optional().or(z.literal('')),
  franchiseePhone: z.string().trim().max(50).optional().or(z.literal('')),
});

// ---------------------------------------------------------------- Diretoria: convites (links)
npsRouter.get('/invites', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(`${INVITE_SELECT} ORDER BY i.created_at DESC`);
  return res.json(rows.map((r) => toInviteDto(r, req)));
});

npsRouter.post('/invites', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const parsed = InviteSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
  const d = parsed.data;
  const u = actor(req);
  const id = newId('inv');
  const token = newToken();
  await pool.query(
    `INSERT INTO nps_invites (id, token, survey_id, unit_name, city_uf, inauguration_date, franchisee_name, franchisee_email, franchisee_phone, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, token, SURVEY.id, d.unitName, d.cityUf || null, d.inaugurationDate || null, d.franchiseeName, d.franchiseeEmail || null, d.franchiseePhone || null, u.id, u.name]
  );
  await writeAudit(u, 'NPS_INVITE_CREATED', id, d.unitName, `Link da pesquisa gerado para ${d.franchiseeName} (${d.unitName}).`, 'SUCCESS', getClientIp(req));
  const { rows } = await pool.query(`${INVITE_SELECT} WHERE i.id = $1`, [id]);
  return res.status(201).json(toInviteDto(rows[0], req));
});

// Editar dados do convite (só enquanto não foi respondido)
npsRouter.patch('/invites/:id', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const parsed = InviteSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
  const d = parsed.data;
  const { rowCount } = await pool.query(
    `UPDATE nps_invites SET unit_name=$2, city_uf=$3, inauguration_date=$4, franchisee_name=$5, franchisee_email=$6, franchisee_phone=$7
      WHERE id=$1 AND status='pending'`,
    [req.params.id, d.unitName, d.cityUf || null, d.inaugurationDate || null, d.franchiseeName, d.franchiseeEmail || null, d.franchiseePhone || null]
  );
  if (!rowCount) return res.status(409).json({ error: 'Só é possível editar links que ainda não foram respondidos.' });
  await writeAudit(actor(req), 'NPS_INVITE_EDITED', req.params.id, d.unitName, 'Dados do link da pesquisa alterados.', 'SUCCESS', getClientIp(req));
  const { rows } = await pool.query(`${INVITE_SELECT} WHERE i.id = $1`, [req.params.id]);
  return res.json(toInviteDto(rows[0], req));
});

// Cancelar o link (o franqueado não consegue mais abrir)
npsRouter.post('/invites/:id/cancel', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `UPDATE nps_invites SET status='canceled', canceled_at=NOW() WHERE id=$1 AND status='pending' RETURNING unit_name`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(409).json({ error: 'Este link já foi respondido ou cancelado.' });
  await writeAudit(actor(req), 'NPS_INVITE_CANCELED', req.params.id, rows[0].unit_name, 'Link da pesquisa cancelado.', 'SUCCESS', getClientIp(req));
  return res.json({ ok: true });
});

// Gerar um link novo (o anterior deixa de funcionar) — ex.: link enviado para a pessoa errada
npsRouter.post('/invites/:id/new-link', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `UPDATE nps_invites SET token=$2, status='pending', canceled_at=NULL, opened_at=NULL WHERE id=$1 AND status<>'answered' RETURNING unit_name`,
    [req.params.id, newToken()]
  );
  if (!rows[0]) return res.status(409).json({ error: 'Este link já foi respondido.' });
  await writeAudit(actor(req), 'NPS_INVITE_RELINKED', req.params.id, rows[0].unit_name, 'Novo link gerado; o anterior foi desativado.', 'SUCCESS', getClientIp(req));
  const { rows: r2 } = await pool.query(`${INVITE_SELECT} WHERE i.id = $1`, [req.params.id]);
  return res.json(toInviteDto(r2[0], req));
});

// Excluir (só links não respondidos)
npsRouter.delete('/invites/:id', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(`DELETE FROM nps_invites WHERE id=$1 AND status<>'answered' RETURNING unit_name`, [req.params.id]);
  if (!rows[0]) return res.status(409).json({ error: 'Pesquisas respondidas não podem ser excluídas.' });
  await writeAudit(actor(req), 'NPS_INVITE_DELETED', req.params.id, rows[0].unit_name, 'Link da pesquisa excluído.', 'SUCCESS', getClientIp(req));
  return res.json({ ok: true });
});

// Enviar o link por e-mail (usa o SMTP da tela Integração)
npsRouter.post('/invites/:id/send-email', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM nps_invites WHERE id=$1', [req.params.id]);
  const inv = rows[0];
  if (!inv || inv.status !== 'pending') return res.status(409).json({ error: 'Este link não está disponível para envio.' });
  if (!inv.franchisee_email) return res.status(400).json({ error: 'Cadastre o e-mail do franqueado para enviar por e-mail.' });
  const u = actor(req);
  const result = await sendSurveyInviteEmail(inv.franchisee_email, inv.franchisee_name, inv.unit_name, surveyLink(req, inv.token), u.name);
  await writeAudit(u, 'NPS_INVITE_EMAILED', inv.id, inv.unit_name, result.success ? `Link enviado por e-mail para ${inv.franchisee_email}.` : `Falha ao enviar e-mail: ${result.message}`, result.success ? 'SUCCESS' : 'DENIED', getClientIp(req));
  if (!result.success) return res.status(422).json({ error: result.message });
  return res.json({ ok: true, message: result.message });
});

// ---------------------------------------------------------------- Diretoria: respostas
npsRouter.get('/responses/:inviteId', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.*, i.unit_name, i.city_uf, i.inauguration_date, i.franchisee_name, i.franchisee_email, i.franchisee_phone, i.created_by_name, i.created_at AS invited_at
       FROM nps_responses r JOIN nps_invites i ON i.id = r.invite_id WHERE r.invite_id = $1`,
    [req.params.inviteId]
  );
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Resposta não encontrada.' });
  return res.json({
    inviteId: r.invite_id,
    unitName: r.unit_name,
    franchiseeName: r.franchisee_name,
    franchiseeEmail: r.franchisee_email,
    franchiseePhone: r.franchisee_phone,
    invitedBy: r.created_by_name,
    invitedAt: r.invited_at,
    general: r.general,
    answers: r.answers,
    npsScore: r.nps_score,
    npsCategory: r.nps_category,
    satisfactionAvg: r.satisfaction_avg !== null ? Number(r.satisfaction_avg) : null,
    answeredAt: r.created_at,
    treatment: {
      analystName: r.analyst_name,
      analysisDate: dateOnly(r.analysis_date),
      needsAction: r.needs_action,
      returnDeadline: dateOnly(r.return_deadline),
      internalNotes: r.internal_notes,
      treatedBy: r.treated_by,
      treatedAt: r.treated_at,
    },
  });
});

const TreatmentSchema = z.object({
  analystName: z.string().trim().max(255).optional().or(z.literal('')),
  analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  needsAction: z.boolean().nullable().optional(),
  returnDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  internalNotes: z.string().max(5000).optional().or(z.literal('')),
});

// "Uso interno - tratamento da pesquisa" (seção 13 do formulário em papel)
npsRouter.patch('/responses/:inviteId/treatment', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const parsed = TreatmentSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Dados do tratamento inválidos.' });
  const t = parsed.data;
  const u = actor(req);
  const { rows } = await pool.query(
    `UPDATE nps_responses SET analyst_name=$2, analysis_date=$3, needs_action=$4, return_deadline=$5, internal_notes=$6, treated_by=$7, treated_at=NOW()
      WHERE invite_id=$1 RETURNING invite_id`,
    [req.params.inviteId, t.analystName || null, t.analysisDate || null, t.needsAction ?? null, t.returnDeadline || null, t.internalNotes || null, u.name]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Resposta não encontrada.' });
  await writeAudit(u, 'NPS_RESPONSE_TREATED', req.params.inviteId, 'Tratamento da pesquisa', 'Tratamento interno da pesquisa atualizado.', 'SUCCESS', getClientIp(req));
  return res.json({ ok: true });
});

// ---------------------------------------------------------------- Diretoria: painel
function buildStats(resp: any[]) {
  const scores = resp.map((r) => r.nps_score).filter((s) => typeof s === 'number');
  const avgs = resp.map((r) => satisfactionAverage(r.answers || {})).filter((v): v is number => v !== null);
  return {
    responses: resp.length,
    nps: computeNps(scores),
    promoters: scores.filter((s) => s >= 9).length,
    passives: scores.filter((s) => s >= 7 && s <= 8).length,
    detractors: scores.filter((s) => s <= 6).length,
    satisfactionAvg: avgs.length ? +(avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2) : null,
  };
}

npsRouter.get('/summary', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  // Período: últimos N meses (0 = todo o histórico)
  const months = Math.min(Math.max(parseInt(String(req.query.months ?? '12'), 10) || 0, 0), 120);
  const now = new Date();
  const from = months ? new Date(now.getFullYear(), now.getMonth() - months + 1, 1) : null;
  const prevFrom = months ? new Date(now.getFullYear(), now.getMonth() - 2 * months + 1, 1) : null;

  const { rows: allResp } = await pool.query(
    `SELECT r.answers, r.nps_score, r.nps_category, r.satisfaction_avg, r.created_at, r.needs_action, r.treated_at, r.return_deadline,
            i.id AS invite_id, i.unit_name, i.city_uf, i.franchisee_name
       FROM nps_responses r JOIN nps_invites i ON i.id = r.invite_id ORDER BY r.created_at ASC`
  );
  const resp = from ? allResp.filter((r) => new Date(r.created_at) >= from) : allResp;
  const prev = from && prevFrom ? allResp.filter((r) => new Date(r.created_at) >= prevFrom && new Date(r.created_at) < from) : [];

  const { rows: invRows } = await pool.query(`SELECT status, created_at FROM nps_invites`);
  const inPeriod = from ? invRows.filter((r) => new Date(r.created_at) >= from) : invRows;
  const counts = { pending: 0, answered: 0, canceled: 0 } as Record<string, number>;
  inPeriod.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));

  const nums = questionNumbers();
  const scores = resp.map((r) => r.nps_score).filter((s) => typeof s === 'number');
  // Média de cada pergunta de 1 a 5, por seção
  const sections = SURVEY.sections
    .map((s, idx) => {
      const qs = s.questions
        .filter((q) => q.type === 'scale5')
        .map((q) => {
          const vals = resp.map((r) => r.answers?.[q.id]).filter((v: any) => typeof v === 'number');
          return { id: q.id, number: nums[q.id], label: q.label, avg: vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : null, count: vals.length };
        });
      const all = qs.filter((q) => q.avg !== null);
      return { id: s.id, number: idx + 3, title: s.title, avg: all.length ? +(all.reduce((a, q) => a + (q.avg as number), 0) / all.length).toFixed(2) : null, questions: qs };
    })
    .filter((s) => s.questions.length);
  // Respostas de múltipla escolha (contagem por opção)
  const choices = allQuestions()
    .filter((q) => q.type === 'choice')
    .map((q: any) => ({
      id: q.id,
      number: nums[q.id],
      label: q.label,
      options: q.options.map((o: string) => ({ option: o, count: resp.filter((r) => r.answers?.[q.id] === o).length })),
    }));
  // Evolução mensal do NPS (todos os meses do período, mesmo sem resposta)
  const monthKeys: string[] = [];
  if (from) {
    for (let d = new Date(from); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  } else {
    resp.forEach((r) => {
      const k = new Date(r.created_at).toISOString().slice(0, 7);
      if (!monthKeys.includes(k)) monthKeys.push(k);
    });
  }
  const monthly = monthKeys.map((k) => {
    const s = resp.filter((r) => new Date(r.created_at).toISOString().slice(0, 7) === k).map((r) => r.nps_score);
    return { month: k, nps: computeNps(s), responses: s.length };
  });
  // Por unidade (a resposta mais recente de cada unidade)
  const unitMap = new Map<string, any[]>();
  resp.forEach((r) => {
    const k = r.unit_name;
    if (!unitMap.has(k)) unitMap.set(k, []);
    unitMap.get(k)!.push(r);
  });
  const units = Array.from(unitMap.entries())
    .map(([unitName, list]) => {
      const last = list[list.length - 1];
      return {
        unitName,
        cityUf: last.city_uf,
        responses: list.length,
        lastScore: last.nps_score,
        lastCategory: last.nps_category,
        nps: computeNps(list.map((r) => r.nps_score)),
        satisfactionAvg: buildStats(list).satisfactionAvg,
        lastInviteId: last.invite_id,
        lastAt: last.created_at,
      };
    })
    .sort((a, b) => (b.lastScore ?? -1) - (a.lastScore ?? -1));

  const current = buildStats(resp);
  const previous = prev.length ? buildStats(prev) : null;
  return res.json({
    period: { months, from: from ? from.toISOString().slice(0, 10) : null, to: now.toISOString().slice(0, 10) },
    invites: counts,
    ...current,
    previous,
    distribution: Array.from({ length: 11 }, (_, i) => scores.filter((s) => s === i).length),
    pendingTreatment: resp.filter((r) => !r.treated_at).length,
    detractorsPendingTreatment: resp.filter((r) => !r.treated_at && r.nps_category === 'detrator').length,
    needsAction: resp.filter((r) => r.needs_action === true).length,
    sections,
    choices,
    monthly,
    units,
  });
});

// Exportar todas as respostas (CSV para Excel, separado por ponto e vírgula)
npsRouter.get('/export.csv', requireAuth, requireRole(...DIRECTORS), async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.*, i.unit_name, i.city_uf, i.inauguration_date, i.franchisee_name, i.franchisee_email
       FROM nps_responses r JOIN nps_invites i ON i.id = r.invite_id ORDER BY r.created_at DESC`
  );
  const nums = questionNumbers();
  const qs = allQuestions();
  const cols: Array<[string, (r: any) => any]> = [
    ['Unidade', (r) => r.general?.unitName || r.unit_name],
    ['Cidade / UF', (r) => r.general?.cityUf || r.city_uf],
    ['Data da inauguração', (r) => r.general?.inaugurationDate || dateOnly(r.inauguration_date)],
    ['Franqueado', (r) => r.general?.franchiseeName || r.franchisee_name],
    ['Data do preenchimento', (r) => dateOnly(r.created_at)],
    ['NPS (0-10)', (r) => r.nps_score],
    ['Classificação', (r) => r.nps_category],
    ['Média 1-5', (r) => (r.satisfaction_avg !== null ? String(r.satisfaction_avg).replace('.', ',') : '')],
  ];
  qs.forEach((q: any) => {
    cols.push([`${nums[q.id] ? nums[q.id] + '. ' : ''}${q.label}`, (r) => r.answers?.[q.id]]);
    if (q.otherOption) cols.push([`${nums[q.id]}. Outro (qual)`, (r) => r.answers?.[`${q.id}_outro`]]);
    if (q.followUp) cols.push([q.followUp.label, (r) => r.answers?.[q.followUp.id]]);
  });
  cols.push(
    ['Responsável pela análise', (r) => r.analyst_name],
    ['Data da análise', (r) => dateOnly(r.analysis_date)],
    ['Necessita plano de ação?', (r) => (r.needs_action === null ? '' : r.needs_action ? 'Sim' : 'Não')],
    ['Prazo para retorno ao franqueado', (r) => dateOnly(r.return_deadline)],
    ['Observações internas', (r) => r.internal_notes]
  );
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cols.map((c) => esc(c[0])).join(';'), ...rows.map((r) => cols.map((c) => esc(c[1](r))).join(';'))].join('\r\n');
  await writeAudit(actor(req), 'NPS_EXPORTED', '', 'Respostas NPS', `Exportação de ${rows.length} resposta(s) em CSV.`, 'SUCCESS', getClientIp(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="NPS - Respostas - ${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
});

// ---------------------------------------------------------------- Formulário público (sem login)
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' } });
const validToken = (t: string) => /^[A-Za-z0-9_-]{20,60}$/.test(t);

publicNpsRouter.get('/:token', publicLimiter, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!validToken(req.params.token)) return res.status(404).json({ error: 'Link inválido.' });
  const { rows } = await pool.query('SELECT * FROM nps_invites WHERE token = $1', [req.params.token]);
  const inv = rows[0];
  if (!inv) return res.status(404).json({ error: 'Link inválido ou desativado. Peça um novo link à diretoria.' });
  if (inv.status === 'canceled') return res.status(410).json({ error: 'Este link foi cancelado pela diretoria.' });
  if (inv.status === 'answered') return res.json({ status: 'answered', unitName: inv.unit_name, franchiseeName: inv.franchisee_name, answeredAt: inv.answered_at });
  if (!inv.opened_at) await pool.query('UPDATE nps_invites SET opened_at = NOW() WHERE id = $1', [inv.id]).catch(() => {});
  return res.json({
    status: 'pending',
    unitName: inv.unit_name,
    cityUf: inv.city_uf,
    inaugurationDate: dateOnly(inv.inauguration_date),
    franchiseeName: inv.franchisee_name,
  });
});

const GeneralSchema = z.object({
  unitName: z.string().trim().min(1, 'Informe o nome da unidade.').max(255),
  cityUf: z.string().trim().min(1, 'Informe a cidade / UF.').max(255),
  inaugurationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data da inauguração.'),
  franchiseeName: z.string().trim().min(1, 'Informe o nome do franqueado.').max(255),
});

publicNpsRouter.post('/:token', publicLimiter, async (req: Request, res: Response) => {
  if (!validToken(req.params.token)) return res.status(404).json({ error: 'Link inválido.' });
  const g = GeneralSchema.safeParse(req.body?.general || {});
  if (!g.success) return res.status(400).json({ error: g.error.issues[0]?.message || 'Preencha as informações gerais.' });
  const answers: Answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  // Remove respostas de acompanhamento que não se aplicam (ex.: motivo quando respondeu "Sim")
  for (const q of allQuestions()) {
    if (q.type === 'choice' && q.followUp && !q.followUp.when.includes(String(answers[q.id]))) delete answers[q.followUp.id];
    if (q.type === 'choice' && q.otherOption && answers[q.id] !== q.otherOption) delete answers[`${q.id}_outro`];
    if (typeof answers[q.id] === 'string') answers[q.id] = String(answers[q.id]).trim();
  }
  const errors = validateAnswers(answers);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM nps_invites WHERE token = $1 FOR UPDATE', [req.params.token]);
    const inv = rows[0];
    if (!inv) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Link inválido ou desativado.' });
    }
    if (inv.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: inv.status === 'answered' ? 'Esta pesquisa já foi respondida. Obrigado!' : 'Este link foi cancelado pela diretoria.' });
    }
    const score = Number(answers.nps);
    await client.query(
      `INSERT INTO nps_responses (id, invite_id, survey_id, general, answers, nps_score, nps_category, satisfaction_avg, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [newId('resp'), inv.id, inv.survey_id, JSON.stringify(g.data), JSON.stringify(answers), score, npsCategory(score), satisfactionAverage(answers), getClientIp(req), String(req.headers['user-agent'] || '').slice(0, 500)]
    );
    await client.query(`UPDATE nps_invites SET status='answered', answered_at=NOW() WHERE id=$1`, [inv.id]);
    await client.query('COMMIT');
    await writeAudit(
      { id: 'franqueado', name: g.data.franchiseeName, role: 'FRANQUEADO', departmentName: g.data.unitName },
      'NPS_RESPONSE_SUBMITTED',
      inv.id,
      g.data.unitName,
      `Pesquisa respondida. NPS ${score} (${npsCategory(score)}).`,
      'SUCCESS',
      getClientIp(req),
      'Formulário público'
    );
    broadcastChange('nps');
    return res.status(201).json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[NPS SUBMIT ERROR]', err);
    return res.status(500).json({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' });
  } finally {
    client.release();
  }
});
