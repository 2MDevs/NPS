import React, { useMemo, useState } from 'react';
import { Eye, Download, FileSpreadsheet, Search, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Invite, Summary, npsApi, fmtDate, scoreColor, npsIndexColor, pct } from '../api';
import { Card, Empty, CategoryBadge, BarRow } from '../ui';

// ---------------------------------------------------------------- Respostas
export const ResponsesView: React.FC<{ invites: Invite[]; onOpen: (id: string) => void }> = ({ invites, onOpen }) => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | 'promotor' | 'neutro' | 'detrator'>('all');
  const answered = useMemo(
    () =>
      invites
        .filter((i) => i.status === 'answered')
        .filter((i) => cat === 'all' || i.npsCategory === cat)
        .filter((i) => !q.trim() || `${i.unitName} ${i.franchiseeName}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => String(b.answeredAt).localeCompare(String(a.answeredAt))),
    [invites, q, cat]
  );
  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          {(['all', 'promotor', 'neutro', 'detrator'] as const).map((c) => (
            <button key={c} type="button" className={`nps-btn nps-btn-sm ${cat === c ? 'nps-btn-primary' : 'nps-btn-ghost'}`} onClick={() => setCat(c)}>
              {c === 'all' ? 'Todas' : c === 'promotor' ? 'Promotores' : c === 'neutro' ? 'Neutros' : 'Detratores'}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 nps-muted" />
          <input className="nps-input" style={{ paddingLeft: 36 }} placeholder="Buscar unidade ou franqueado" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {answered.length === 0 ? (
        <Empty title="Nenhuma resposta encontrada" text="As pesquisas respondidas pelos franqueados aparecem aqui." />
      ) : (
        <div className="overflow-x-auto">
          <table className="nps-table min-w-[760px]">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Franqueado</th>
                <th>Respondida em</th>
                <th>NPS</th>
                <th>Média 1-5</th>
                <th>Tratamento</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {answered.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-[var(--nps-panel-2)]" onClick={() => onOpen(i.id)}>
                  <td className="font-semibold">
                    {i.unitName}
                    <div className="nps-muted text-[12px] font-normal">{i.cityUf}</div>
                  </td>
                  <td>{i.franchiseeName}</td>
                  <td>{fmtDate(i.answeredAt)}</td>
                  <td>
                    <CategoryBadge category={i.npsCategory} score={i.npsScore} />
                  </td>
                  <td>{i.satisfactionAvg?.toFixed(1).replace('.', ',') ?? '—'}</td>
                  <td>
                    {i.treated ? (
                      <span className="nps-badge" style={{ background: 'color-mix(in srgb, #34a853 18%, transparent)' }}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--nps-green)]" /> {i.needsAction ? 'Com plano de ação' : 'Analisada'}
                      </span>
                    ) : (
                      <span className="nps-badge" style={{ background: 'color-mix(in srgb, #f6d35c 25%, transparent)' }}>
                        Aguardando análise
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <Eye className="w-4 h-4 inline nps-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------- Indicadores
export const IndicatorsView: React.FC<{ summary: Summary }> = ({ summary: s }) => {
  const maxDist = Math.max(1, ...s.distribution);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Distribuição das notas (0 a 10)">
          <div className="flex items-end gap-1.5 h-48">
            {s.distribution.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div className="text-[12px] font-semibold">{n || ''}</div>
                <div className="w-full rounded-t-md" style={{ height: `${(n / maxDist) * 80 + (n ? 4 : 1)}%`, background: scoreColor(i) }} />
                <div className="text-[12px] nps-muted">{i}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Resumo do período">
          <div className="grid grid-cols-2 gap-4 text-[14px]">
            <div>
              <div className="nps-muted">NPS da rede</div>
              <div className="nps-title text-[34px]" style={{ color: npsIndexColor(s.nps) }}>
                {s.nps ?? '—'}
              </div>
            </div>
            <div>
              <div className="nps-muted">Média de satisfação (1 a 5)</div>
              <div className="nps-title text-[34px]">{s.satisfactionAvg?.toFixed(1).replace('.', ',') ?? '—'}</div>
            </div>
            <div>
              <div className="nps-muted">Respostas</div>
              <div className="font-bold text-[20px]">{s.responses}</div>
            </div>
            <div>
              <div className="nps-muted">Taxa de resposta</div>
              <div className="font-bold text-[20px]">{pct(s.invites.answered, s.invites.answered + s.invites.pending)}%</div>
            </div>
          </div>
          <p className="nps-muted text-[12.5px] mt-4">NPS = % de promotores (9-10) menos % de detratores (0-6). Vai de −100 a 100.</p>
        </Card>
      </div>

      <Card title="Média por pergunta (1 a 5)">
        <div className="space-y-5">
          {s.sections.map((sec) => (
            <div key={sec.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-[14px]">
                  {sec.number}. {sec.title}
                </div>
                <div className="font-bold">{sec.avg?.toFixed(1).replace('.', ',') ?? '—'}</div>
              </div>
              {sec.questions.map((q) => (
                <BarRow
                  key={q.id}
                  labelWidth="w-[58%]"
                  label={
                    <span title={q.label}>
                      {q.number}. {q.label}
                    </span>
                  }
                  value={q.avg ?? 0}
                  max={5}
                  color={(q.avg ?? 0) >= 4 ? 'var(--nps-green)' : (q.avg ?? 0) >= 3 ? 'var(--nps-yellow)' : 'var(--nps-red)'}
                  display={q.avg?.toFixed(1).replace('.', ',') ?? '—'}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Perguntas de múltipla escolha">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {s.choices.map((c) => {
            const total = c.options.reduce((a, o) => a + o.count, 0);
            return (
              <div key={c.id}>
                <div className="font-semibold text-[14px] mb-1">
                  {c.number}. {c.label}
                </div>
                {c.options.map((o) => (
                  <BarRow key={o.option} labelWidth="w-[40%]" label={o.option} value={o.count} max={Math.max(1, total)} color="var(--nps-yellow)" display={`${pct(o.count, total)}%`} />
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- Planos de ação
export const ActionPlansView: React.FC<{ invites: Invite[]; onOpen: (id: string) => void }> = ({ invites, onOpen }) => {
  const answered = invites.filter((i) => i.status === 'answered');
  const pendingAnalysis = answered.filter((i) => !i.treated).sort((a, b) => (a.npsScore ?? 11) - (b.npsScore ?? 11));
  const withPlan = answered.filter((i) => i.treated && i.needsAction);
  const Row: React.FC<{ i: Invite }> = ({ i }) => (
    <button type="button" onClick={() => onOpen(i.id)} className="w-full flex items-center gap-3 py-3 border-b border-[var(--nps-border)] last:border-0 text-left hover:opacity-90">
      <CategoryBadge category={i.npsCategory} score={i.npsScore} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{i.unitName}</div>
        <div className="nps-muted text-[12.5px] truncate">
          {i.franchiseeName} · respondida em {fmtDate(i.answeredAt)}
        </div>
      </div>
      <Eye className="w-4 h-4 nps-muted" />
    </button>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title={`Aguardando análise (${pendingAnalysis.length})`} icon={<CalendarClock className="w-5 h-5" />}>
        <p className="nps-muted text-[13px] -mt-2 mb-2">Detratores primeiro. Abra a resposta e preencha o “Uso interno”.</p>
        {pendingAnalysis.length ? pendingAnalysis.map((i) => <Row key={i.id} i={i} />) : <Empty title="Tudo analisado" />}
      </Card>
      <Card title={`Com plano de ação (${withPlan.length})`} icon={<CheckCircle2 className="w-5 h-5" />}>
        <p className="nps-muted text-[13px] -mt-2 mb-2">Respostas marcadas como “Necessita plano de ação: Sim”.</p>
        {withPlan.length ? withPlan.map((i) => <Row key={i.id} i={i} />) : <Empty title="Nenhum plano de ação aberto" />}
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- Unidades
export const UnitsView: React.FC<{ summary: Summary; onOpen: (id: string) => void }> = ({ summary: s, onOpen }) => (
  <Card>
    {s.units.length === 0 ? (
      <Empty title="Nenhuma unidade respondeu no período" />
    ) : (
      <div className="overflow-x-auto">
        <table className="nps-table min-w-[640px]">
          <thead>
            <tr>
              <th>Unidade</th>
              <th style={{ width: '34%' }}>Nota (0 a 10)</th>
              <th>Classificação</th>
              <th>Média 1-5</th>
              <th>Respostas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.units.map((u) => (
              <tr key={u.unitName}>
                <td className="font-semibold">
                  {u.unitName}
                  <div className="nps-muted text-[12px] font-normal">{u.cityUf}</div>
                </td>
                <td>
                  <BarRow label="" labelWidth="w-0" value={u.lastScore} max={10} color={scoreColor(u.lastScore)} />
                </td>
                <td>
                  <CategoryBadge category={u.lastCategory} />
                </td>
                <td>{u.satisfactionAvg?.toFixed(1).replace('.', ',') ?? '—'}</td>
                <td>{u.responses}</td>
                <td className="text-right">
                  <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" onClick={() => onOpen(u.lastInviteId)}>
                    <Eye className="w-4 h-4" /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

// ---------------------------------------------------------------- Relatórios
export const ReportsView: React.FC<{ summary: Summary | null }> = ({ summary }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
    <Card title="Todas as respostas (Excel)" icon={<FileSpreadsheet className="w-5 h-5" />}>
      <p className="nps-muted text-[14px] mb-4">
        Planilha com uma linha por franqueado: informações gerais, todas as perguntas, nota NPS, classificação e o tratamento interno. Abre direto no Excel.
      </p>
      <a className="nps-btn nps-btn-primary" href={npsApi.exportUrl}>
        <Download className="w-4 h-4" /> Baixar planilha (.csv)
      </a>
    </Card>
    <Card title="Imprimir o painel" icon={<Download className="w-5 h-5" />}>
      <p className="nps-muted text-[14px] mb-4">Abra o Dashboard e use “Imprimir” para salvar em PDF e levar para reunião.</p>
      <button type="button" className="nps-btn nps-btn-ghost" onClick={() => window.print()}>
        Imprimir esta tela
      </button>
      {summary && (
        <p className="nps-muted text-[12.5px] mt-4">
          Período atual: {summary.responses} resposta(s), NPS {summary.nps ?? '—'}.
        </p>
      )}
    </Card>
  </div>
);
