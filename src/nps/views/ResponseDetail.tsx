import React, { useEffect, useState } from 'react';
import { Printer, Save } from 'lucide-react';
import { SURVEY, SCALE5_LABELS, questionNumbers } from '../../../shared/survey';
import { npsApi, ResponseDetail, Treatment, fmtDate, fmtDateTime } from '../api';
import { Modal, Loading, ErrorBox, CategoryBadge, sentence } from '../ui';

const nums = questionNumbers();

const Answer: React.FC<{ value: any; type: string }> = ({ value, type }) => {
  if (value === undefined || value === null || value === '') return <span className="nps-muted">Sem resposta</span>;
  if (type === 'scale5')
    return (
      <span className="font-semibold">
        {value} — {SCALE5_LABELS[Number(value) - 1]}
      </span>
    );
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
};

export const ResponseDetailModal: React.FC<{ inviteId: string; onClose: () => void; onSaved: () => void; toast: (m: string) => void }> = ({
  inviteId,
  onClose,
  onSaved,
  toast,
}) => {
  const [data, setData] = useState<ResponseDetail | null>(null);
  const [error, setError] = useState('');
  const [t, setT] = useState<Treatment>({ analystName: '', analysisDate: '', needsAction: null, returnDeadline: '', internalNotes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError('');
    npsApi
      .response(inviteId)
      .then((d) => {
        setData(d);
        setT({
          analystName: d.treatment.analystName || '',
          analysisDate: d.treatment.analysisDate || '',
          needsAction: d.treatment.needsAction,
          returnDeadline: d.treatment.returnDeadline || '',
          internalNotes: d.treatment.internalNotes || '',
        });
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [inviteId]);

  const save = async () => {
    setSaving(true);
    try {
      await npsApi.saveTreatment(inviteId, t);
      toast('Tratamento salvo.');
      onSaved();
      load();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={data ? `${data.general.unitName || data.unitName} — ${data.general.franchiseeName || data.franchiseeName}` : 'Resposta'}
      onClose={onClose}
      footer={
        data && (
          <>
            <button type="button" className="nps-btn nps-btn-ghost" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button type="button" className="nps-btn nps-btn-primary" onClick={save} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar tratamento'}
            </button>
          </>
        )
      }
    >
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="space-y-6 text-[14px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="nps-card p-3">
              <div className="nps-muted text-[12px]">NPS (0 a 10)</div>
              <div className="nps-title text-[30px]">{data.npsScore}</div>
              <CategoryBadge category={data.npsCategory} />
            </div>
            <div className="nps-card p-3">
              <div className="nps-muted text-[12px]">Média 1 a 5</div>
              <div className="nps-title text-[30px]">{data.satisfactionAvg?.toFixed(1).replace('.', ',') ?? '—'}</div>
            </div>
            <div className="nps-card p-3">
              <div className="nps-muted text-[12px]">Respondida em</div>
              <div className="font-semibold mt-1">{fmtDateTime(data.answeredAt)}</div>
            </div>
            <div className="nps-card p-3">
              <div className="nps-muted text-[12px]">Link enviado por</div>
              <div className="font-semibold mt-1">{data.invitedBy || '—'}</div>
            </div>
          </div>

          <div>
            <div className="font-bold text-[15px] mb-2">1. Informações gerais</div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              <div>
                <span className="nps-muted">Unidade:</span> {data.general.unitName}
              </div>
              <div>
                <span className="nps-muted">Cidade / UF:</span> {data.general.cityUf}
              </div>
              <div>
                <span className="nps-muted">Inauguração:</span> {fmtDate(data.general.inaugurationDate)}
              </div>
              <div>
                <span className="nps-muted">Franqueado:</span> {data.general.franchiseeName}
              </div>
            </div>
          </div>

          {SURVEY.sections.map((s, idx) => (
            <div key={s.id}>
              <div className="font-bold text-[15px] mb-2">
                {idx + 3}. {sentence(s.title)}
              </div>
              <div className="space-y-2.5">
                {s.questions.map((q: any) => {
                  const v = data.answers[q.id];
                  if (q.type === 'text' && !v) return null;
                  return (
                    <div key={q.id} className="border-l-2 border-[var(--nps-yellow)] pl-3">
                      <div className="nps-muted text-[13px]">
                        {nums[q.id] ? `${nums[q.id]}. ` : ''}
                        {q.label}
                      </div>
                      <Answer value={q.type === 'choice' && v === q.otherOption ? `Outro: ${data.answers[`${q.id}_outro`] || ''}` : v} type={q.type} />
                      {q.followUp && data.answers[q.followUp.id] && (
                        <div className="mt-1">
                          <span className="nps-muted text-[13px]">{q.followUp.label}</span>
                          <div className="whitespace-pre-wrap">{String(data.answers[q.followUp.id])}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="nps-card p-4" style={{ borderColor: 'var(--nps-yellow)' }}>
            <div className="font-bold text-[15px] mb-3">13. Uso interno — tratamento da pesquisa</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="nps-label">Responsável pela análise</label>
                <input className="nps-input" value={t.analystName || ''} onChange={(e) => setT({ ...t, analystName: e.target.value })} />
              </div>
              <div>
                <label className="nps-label">Data da análise</label>
                <input type="date" className="nps-input" value={t.analysisDate || ''} onChange={(e) => setT({ ...t, analysisDate: e.target.value })} />
              </div>
              <div>
                <label className="nps-label">NPS da resposta</label>
                <div className="h-[42px] flex items-center">
                  <CategoryBadge category={data.npsCategory} score={data.npsScore} />
                  <span className="nps-muted text-[12px] ml-2">(Detrator 0-6 · Neutro 7-8 · Promotor 9-10)</span>
                </div>
              </div>
              <div>
                <label className="nps-label">Necessita plano de ação?</label>
                <div className="flex gap-2">
                  {[
                    { v: false, l: 'Não' },
                    { v: true, l: 'Sim' },
                  ].map((o) => (
                    <button key={o.l} type="button" className={`nps-btn flex-1 ${t.needsAction === o.v ? 'nps-btn-primary' : 'nps-btn-ghost'}`} onClick={() => setT({ ...t, needsAction: o.v })}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="nps-label">Prazo para retorno ao franqueado</label>
                <input type="date" className="nps-input" value={t.returnDeadline || ''} onChange={(e) => setT({ ...t, returnDeadline: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="nps-label">Observações internas / plano de ação</label>
                <textarea className="nps-input" value={t.internalNotes || ''} onChange={(e) => setT({ ...t, internalNotes: e.target.value })} maxLength={5000} />
              </div>
            </div>
            {data.treatment.treatedAt && (
              <div className="nps-muted text-[12px] mt-3">
                Última alteração por {data.treatment.treatedBy} em {fmtDateTime(data.treatment.treatedAt)}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
