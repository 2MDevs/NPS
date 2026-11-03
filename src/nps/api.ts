import { apiRequest } from '../services/apiClient';
import type { Answers } from '../../shared/survey';

export type InviteStatus = 'pending' | 'answered' | 'canceled';

export interface Invite {
  id: string;
  surveyId: string;
  unitName: string;
  cityUf: string | null;
  inaugurationDate: string | null;
  franchiseeName: string;
  franchiseeEmail: string | null;
  franchiseePhone: string | null;
  status: InviteStatus;
  createdBy: string | null;
  createdAt: string;
  openedAt: string | null;
  answeredAt: string | null;
  canceledAt: string | null;
  link: string | null;
  npsScore: number | null;
  npsCategory: 'detrator' | 'neutro' | 'promotor' | null;
  satisfactionAvg: number | null;
  needsAction: boolean | null;
  treated: boolean;
}

export interface InviteInput {
  unitName: string;
  cityUf: string;
  inaugurationDate: string;
  franchiseeName: string;
  franchiseeEmail: string;
  franchiseePhone: string;
}

export interface Treatment {
  analystName: string | null;
  analysisDate: string | null;
  needsAction: boolean | null;
  returnDeadline: string | null;
  internalNotes: string | null;
  treatedBy?: string | null;
  treatedAt?: string | null;
}

export interface ResponseDetail {
  inviteId: string;
  unitName: string;
  franchiseeName: string;
  franchiseeEmail: string | null;
  franchiseePhone: string | null;
  invitedBy: string | null;
  invitedAt: string;
  general: { unitName: string; cityUf: string; inaugurationDate: string; franchiseeName: string };
  answers: Answers;
  npsScore: number;
  npsCategory: 'detrator' | 'neutro' | 'promotor';
  satisfactionAvg: number | null;
  answeredAt: string;
  treatment: Treatment;
}

export interface Stats {
  responses: number;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  satisfactionAvg: number | null;
}

export interface Summary extends Stats {
  period: { months: number; from: string | null; to: string };
  invites: { pending: number; answered: number; canceled: number };
  previous: Stats | null;
  distribution: number[];
  pendingTreatment: number;
  detractorsPendingTreatment: number;
  needsAction: number;
  sections: Array<{
    id: string;
    number: number;
    title: string;
    avg: number | null;
    questions: Array<{ id: string; number: number; label: string; avg: number | null; count: number }>;
  }>;
  choices: Array<{ id: string; number: number; label: string; options: Array<{ option: string; count: number }> }>;
  monthly: Array<{ month: string; nps: number | null; responses: number }>;
  units: Array<{
    unitName: string;
    cityUf: string | null;
    responses: number;
    lastScore: number;
    lastCategory: 'detrator' | 'neutro' | 'promotor';
    nps: number | null;
    satisfactionAvg: number | null;
    lastInviteId: string;
    lastAt: string;
  }>;
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const npsApi = {
  summary: (months: number) => apiRequest<Summary>(`/api/nps/summary?months=${months}`),
  invites: () => apiRequest<Invite[]>('/api/nps/invites'),
  createInvite: (data: InviteInput) => apiRequest<Invite>('/api/nps/invites', { method: 'POST', ...json(data) }),
  updateInvite: (id: string, data: InviteInput) => apiRequest<Invite>(`/api/nps/invites/${id}`, { method: 'PATCH', ...json(data) }),
  cancelInvite: (id: string) => apiRequest(`/api/nps/invites/${id}/cancel`, { method: 'POST' }),
  newLink: (id: string) => apiRequest<Invite>(`/api/nps/invites/${id}/new-link`, { method: 'POST' }),
  deleteInvite: (id: string) => apiRequest(`/api/nps/invites/${id}`, { method: 'DELETE' }),
  sendEmail: (id: string) => apiRequest<{ ok: boolean; message: string }>(`/api/nps/invites/${id}/send-email`, { method: 'POST' }),
  response: (inviteId: string) => apiRequest<ResponseDetail>(`/api/nps/responses/${inviteId}`),
  saveTreatment: (inviteId: string, t: Treatment) =>
    apiRequest(`/api/nps/responses/${inviteId}/treatment`, { method: 'PATCH', ...json(t) }),
  exportUrl: '/api/nps/export.csv',
};

// Formulário público (sem login): fetch direto, sem o tratamento de sessão
export async function publicGet(token: string) {
  const res = await fetch(`/api/public/nps/${encodeURIComponent(token)}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível abrir a pesquisa.');
  return data as
    | { status: 'answered'; unitName: string; franchiseeName: string; answeredAt: string }
    | { status: 'pending'; unitName: string; cityUf: string | null; inaugurationDate: string | null; franchiseeName: string };
}

export async function publicSubmit(token: string, general: Record<string, string>, answers: Answers) {
  const res = await fetch(`/api/public/nps/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ general, answers }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Não foi possível enviar. Tente novamente.');
  return data;
}

// ---------------------------------------------------------------- formatação
export const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
export const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const monthLabel = (ym: string) => MONTHS[parseInt(ym.slice(5, 7), 10) - 1] || ym;
export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
export const CATEGORY_LABEL = { promotor: 'Promotor', neutro: 'Neutro', detrator: 'Detrator' } as const;
export const scoreColor = (score: number | null | undefined) =>
  score === null || score === undefined ? 'var(--nps-muted)' : score >= 9 ? 'var(--nps-green)' : score >= 7 ? 'var(--nps-yellow)' : 'var(--nps-red)';
export const npsIndexColor = (nps: number | null | undefined) =>
  nps === null || nps === undefined ? 'var(--nps-muted)' : nps >= 50 ? 'var(--nps-green)' : nps >= 0 ? 'var(--nps-accent)' : 'var(--nps-red)';
