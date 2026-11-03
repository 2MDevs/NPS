import React from 'react';
import { BarChart3, Store, AlertTriangle, ClipboardList, Lightbulb, Users, Meh, Frown, ArrowRight, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Summary, monthLabel, pct, npsIndexColor, scoreColor } from '../api';
import { Card, Gauge, LineChart, BarRow, Delta, Empty, sentence } from '../ui';

export type GoTab = 'responses' | 'indicators' | 'units' | 'send' | 'actions';
type Go = (tab: GoTab) => void;

const KpiCard: React.FC<{ title: string; value: string; delta: React.ReactNode; icon: React.ReactNode }> = ({ title, value, delta, icon }) => (
  <div className="nps-card p-5 flex flex-col justify-between min-h-[150px]">
    <div className="flex items-start justify-between gap-2">
      <div className="text-[16px] font-medium">{title}</div>
      {icon}
    </div>
    <div className="nps-title text-[42px] leading-none mt-3">{value}</div>
    <div className="mt-3">{delta}</div>
  </div>
);

export const DashboardView: React.FC<{ summary: Summary; onGo: Go }> = ({ summary: s, onGo }) => {
  const total = s.promoters + s.passives + s.detractors;
  const prev = s.previous;
  const prevTotal = prev ? prev.promoters + prev.passives + prev.detractors : 0;
  const share = (n: number, t: number) => pct(n, t);
  const d = (cur: number, before: number | undefined) => (prev && before !== undefined ? cur - before : null);

  const sentInPeriod = s.invites.pending + s.invites.answered;
  const sectionPct = s.sections
    .filter((x) => x.avg !== null)
    .map((x) => ({ ...x, pct: Math.round(((x.avg as number) / 5) * 100) }))
    .sort((a, b) => a.pct - b.pct);

  // Ações recomendadas: regras simples, a partir das próprias respostas
  const actions: Array<{ kind: 'red' | 'yellow' | 'green'; title: React.ReactNode; go: GoTab }> = [];
  if (s.detractorsPendingTreatment > 0)
    actions.push({ kind: 'red', title: <><strong>{s.detractorsPendingTreatment} detrator(es)</strong> sem tratamento: retorne ao franqueado.</>, go: 'actions' });
  const worst = sectionPct[0];
  if (worst && worst.pct < 80)
    actions.push({ kind: 'yellow', title: <>Reforçar <strong>{worst.title.toLowerCase()}</strong> ({worst.pct}% de satisfação).</>, go: 'indicators' });
  if (s.invites.pending > 0)
    actions.push({ kind: 'yellow', title: <><strong>{s.invites.pending} pesquisa(s)</strong> enviada(s) ainda sem resposta.</>, go: 'send' });
  const best = sectionPct[sectionPct.length - 1];
  if (best && best.pct >= 80)
    actions.push({ kind: 'green', title: <>Manter o bom desempenho em <strong>{best.title.toLowerCase()}</strong> ({best.pct}%).</>, go: 'indicators' });

  const actionIcon = { red: <AlertCircle className="w-6 h-6 text-[var(--nps-red)] shrink-0" />, yellow: <Info className="w-6 h-6 text-[var(--nps-yellow)] shrink-0" />, green: <CheckCircle2 className="w-6 h-6 text-[var(--nps-green)] shrink-0" /> };
  const ym = (iso: string) => `${monthLabel(iso.slice(0, 7))}/${iso.slice(0, 4)}`;
  const periodLabel = s.period.months && s.period.from ? `${ym(s.period.from)} – ${ym(s.period.to)}` : 'Todo o histórico';

  if (!s.responses) {
    return (
      <div className="nps-card">
        <Empty
          title="Ainda não há respostas neste período"
          text="Gere o link da pesquisa para cada franqueado em “Enviar Pesquisa”. Assim que eles responderem, o painel aparece aqui."
          action={
            <button type="button" className="nps-btn nps-btn-primary" onClick={() => onGo('send')}>
              Enviar pesquisa
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Indicadores principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr] gap-5">
        <div className="nps-card-yellow p-5 flex items-center justify-between gap-2 min-h-[150px]">
          <div>
            <div className="text-[17px] font-bold">NPS da Rede</div>
            <div className="nps-title text-[64px] leading-none mt-1">{s.nps ?? '—'}</div>
            <div className="mt-2">
              <Delta value={d(s.nps ?? 0, prev?.nps ?? undefined)} label="pontos vs. período anterior" />
            </div>
          </div>
          <Gauge value={s.nps} size={170} />
        </div>
        <KpiCard
          title="Promotores (9-10)"
          value={`${share(s.promoters, total)}%`}
          icon={<Users className="w-9 h-9 text-[var(--nps-green)]" />}
          delta={<Delta value={prev ? share(s.promoters, total) - share(prev.promoters, prevTotal) : null} suffix="%" />}
        />
        <KpiCard
          title="Neutros (7-8)"
          value={`${share(s.passives, total)}%`}
          icon={<Meh className="w-9 h-9 text-[var(--nps-yellow)]" />}
          delta={<Delta value={prev ? share(s.passives, total) - share(prev.passives, prevTotal) : null} suffix="%" invert />}
        />
        <KpiCard
          title="Detratores (0-6)"
          value={`${share(s.detractors, total)}%`}
          icon={<Frown className="w-9 h-9 text-[var(--nps-red)]" />}
          delta={<Delta value={prev ? share(s.detractors, total) - share(prev.detractors, prevTotal) : null} suffix="%" invert />}
        />
      </div>

      {/* Evolução + por unidade */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-5">
        <Card title="Evolução do NPS" icon={<BarChart3 className="w-5 h-5" />}>
          <LineChart points={s.monthly.map((m) => ({ label: monthLabel(m.month), value: m.nps, hint: `${m.responses} resposta(s)` }))} />
        </Card>
        <Card
          title="Nota por Unidade"
          icon={<Store className="w-5 h-5" />}
          action={
            <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" onClick={() => onGo('units')}>
              Todas as unidades
            </button>
          }
        >
          <p className="nps-muted text-[12.5px] -mt-2 mb-2">Nota de 0 a 10 da resposta mais recente de cada unidade.</p>
          {s.units.slice(0, 6).map((u) => (
            <BarRow key={u.unitName} label={`${u.unitName}${u.cityUf ? ` - ${u.cityUf}` : ''}`} value={u.lastScore} max={10} color={scoreColor(u.lastScore)} />
          ))}
        </Card>
      </div>

      {/* Atenção, últimas pesquisas e ações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="Principais Pontos de Atenção"
          icon={<AlertTriangle className="w-5 h-5" />}
          action={
            <button type="button" className="text-[13px] font-semibold text-[var(--nps-accent)] inline-flex items-center gap-1" onClick={() => onGo('indicators')}>
              Ver detalhes <ArrowRight className="w-4 h-4" />
            </button>
          }
        >
          {sectionPct.slice(0, 5).map((x) => (
            <BarRow
              key={x.id}
              labelWidth="w-[52%]"
              label={<span title={sentence(x.title)}>{sentence(x.title)}</span>}
              value={x.pct}
              max={100}
              color={x.pct >= 80 ? 'var(--nps-green)' : x.pct >= 60 ? 'var(--nps-yellow)' : 'var(--nps-red)'}
              display={`${x.pct}%`}
            />
          ))}
          <p className="nps-muted text-[12px] mt-2">% = média das notas de 1 a 5 da seção.</p>
        </Card>

        <Card
          title="Últimas Pesquisas"
          icon={<ClipboardList className="w-5 h-5" />}
          action={
            <button type="button" className="text-[13px] font-semibold text-[var(--nps-accent)] inline-flex items-center gap-1" onClick={() => onGo('responses')}>
              Ver todas <ArrowRight className="w-4 h-4" />
            </button>
          }
        >
          <div className="grid grid-cols-3 divide-x divide-[var(--nps-border)]">
            <div className="pr-3">
              <div className="text-[15px]">NPS</div>
              <div className="nps-title text-[42px] leading-none mt-1" style={{ color: npsIndexColor(s.nps) }}>
                {s.nps ?? '—'}
              </div>
            </div>
            <div className="px-3">
              <div className="text-[15px]">Respostas</div>
              <div className="nps-title text-[30px] leading-none mt-2">{pct(s.invites.answered, sentInPeriod)}%</div>
              <div className="nps-muted text-[13px] mt-1">
                {s.invites.answered} de {sentInPeriod}
              </div>
            </div>
            <div className="pl-3">
              <div className="text-[15px]">Período</div>
              <div className="font-bold text-[14px] mt-2">{periodLabel}</div>
            </div>
          </div>
          <div
            className="mt-5 rounded-full px-4 py-2 text-[14px] font-medium flex items-center gap-2"
            style={{ background: 'color-mix(in srgb, #34a853 18%, transparent)', border: '1px solid color-mix(in srgb, #34a853 45%, transparent)' }}
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--nps-green)]" />
            Média geral de satisfação: <strong>{s.satisfactionAvg?.toFixed(1).replace('.', ',') ?? '—'}</strong> de 5
          </div>
        </Card>

        <Card title="Ações Recomendadas" icon={<Lightbulb className="w-5 h-5" />}>
          {actions.length === 0 && <p className="nps-muted text-[14px]">Nenhuma ação pendente no período.</p>}
          <div className="space-y-3">
            {actions.slice(0, 3).map((a, i) => (
              <button key={i} type="button" onClick={() => onGo(a.go)} className="w-full flex items-center gap-3 text-left text-[14px] leading-snug group">
                {actionIcon[a.kind]}
                <span className="flex-1">{a.title}</span>
                <ArrowRight className="w-5 h-5 nps-muted group-hover:text-[var(--nps-yellow)]" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
