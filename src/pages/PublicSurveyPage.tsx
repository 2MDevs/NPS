import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Send, AlertTriangle } from 'lucide-react';
import { SURVEY, SCALE5_LABELS, questionNumbers, validateAnswers, Answers, Question } from '../../shared/survey';
import { publicGet, publicSubmit } from '../nps/api';
import '../nps/nps.css';

/**
 * Formulário que o franqueado abre pelo link individual (sem login).
 * Visual idêntico ao formulário oficial "PESQUISA DE SATISFAÇÃO — Franqueado - Pós-Inauguração".
 */

const Box: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={`form-box ${on ? 'on' : ''}`} aria-hidden="true">
    {on && (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 6.2 4.8 9 10 3" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    )}
  </span>
);

const SectionBar: React.FC<{ n: number; title: string }> = ({ n, title }) => (
  <div className="form-bar">
    <div>{n}</div>
    <div>{title}</div>
  </div>
);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const PublicSurveyPage: React.FC<{ token: string }> = ({ token }) => {
  const [state, setState] = useState<'loading' | 'form' | 'answered' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [general, setGeneral] = useState({ unitName: '', cityUf: '', inaugurationDate: '', franchiseeName: '' });
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const nums = useMemo(() => questionNumbers(), []);

  useEffect(() => {
    document.title = 'Pesquisa de Satisfação do Franqueado - Hummm! Pizzas';
    // O formulário é sempre claro, igual ao papel
    document.documentElement.classList.remove('dark');
    publicGet(token)
      .then((d) => {
        if (d.status === 'answered') {
          setGeneral((g) => ({ ...g, unitName: d.unitName, franchiseeName: d.franchiseeName }));
          setState('answered');
        } else {
          setGeneral({ unitName: d.unitName || '', cityUf: d.cityUf || '', inaugurationDate: d.inaugurationDate || '', franchiseeName: d.franchiseeName || '' });
          setState('form');
        }
      })
      .catch((e) => {
        setError(e.message);
        setState('error');
      });
  }, [token]);

  const set = (id: string, v: string | number) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setMissing((m) => {
      if (!m.has(id)) return m;
      const n = new Set(m);
      n.delete(id);
      return n;
    });
  };

  const submit = async () => {
    setSubmitError('');
    const miss = new Set<string>();
    (['unitName', 'cityUf', 'inaugurationDate', 'franchiseeName'] as const).forEach((k) => !String(general[k]).trim() && miss.add(`g_${k}`));
    for (const s of SURVEY.sections)
      for (const q of s.questions) {
        const v = answers[q.id];
        if (q.type === 'scale5' || q.type === 'nps') {
          if (typeof v !== 'number') miss.add(q.id);
        } else if (q.type === 'choice') {
          if (typeof v !== 'string') miss.add(q.id);
          else if (q.otherOption && v === q.otherOption && !String(answers[`${q.id}_outro`] || '').trim()) miss.add(q.id);
        }
      }
    setMissing(miss);
    if (miss.size) {
      const first = [...miss][0];
      refs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSubmitError(`Faltam ${miss.size} resposta(s) obrigatória(s). Elas estão marcadas em vermelho.`);
      return;
    }
    const errs = validateAnswers(answers);
    if (errs.length) {
      setSubmitError(errs[0]);
      return;
    }
    setSending(true);
    try {
      await publicSubmit(token, general, answers);
      setState('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSending(false);
    }
  };

  const header = (
    <div className="px-5 sm:px-12 pt-8">
      <div className="flex items-start justify-between gap-4">
        <img src="/brand/hummm-logo-claro.svg" alt="hummm! Pizzas" className="h-9 sm:h-11 w-auto" draggable={false} />
        <div className="text-[10px] sm:text-[12px] font-bold text-[#d71920] text-right pt-3">{SURVEY.headerTag}</div>
      </div>
      <h1 className="text-center text-[#d71920] font-extrabold text-[26px] sm:text-[34px] mt-6 tracking-tight">{SURVEY.title}</h1>
      <h2 className="text-center font-bold text-[17px] sm:text-[19px] mt-1">{SURVEY.subtitle}</h2>
    </div>
  );
  const footer = <div className="text-center text-[11px] text-[#666] py-6 px-4 whitespace-pre">{SURVEY.footer}</div>;

  if (state !== 'form') {
    const msg =
      state === 'loading'
        ? { icon: null, title: 'Abrindo a pesquisa…', text: '' }
        : state === 'error'
        ? { icon: <AlertTriangle className="w-10 h-10 text-[#d71920]" />, title: 'Não foi possível abrir a pesquisa', text: error }
        : state === 'answered'
        ? { icon: <CheckCircle2 className="w-10 h-10 text-[#2e9e4f]" />, title: 'Esta pesquisa já foi respondida', text: `A pesquisa da unidade ${general.unitName} já foi enviada. Obrigado!` }
        : { icon: <CheckCircle2 className="w-10 h-10 text-[#2e9e4f]" />, title: 'Pesquisa enviada!', text: SURVEY.thanks };
    return (
      <div className="form-hummm py-0 sm:py-8">
        <div className="form-page min-h-[100dvh] sm:min-h-0">
          {header}
          <div className="px-5 sm:px-12 py-14 text-center">
            {msg.icon && <div className="flex justify-center mb-3">{msg.icon}</div>}
            <div className="text-[19px] font-bold">{msg.title}</div>
            {msg.text && <p className="mt-2 text-[15px] text-[#444] max-w-md mx-auto">{msg.text}</p>}
            {state === 'loading' && <div className="mt-6 mx-auto w-7 h-7 rounded-full border-2 border-[#d71920] border-t-transparent animate-spin" />}
          </div>
          {footer}
        </div>
      </div>
    );
  }

  const req = (id: string) => (missing.has(id) ? 'form-error' : '');

  const renderQuestion = (q: Question) => {
    const n = nums[q.id];
    const title = (
      <div className="form-q">
        {n ? `${n}. ` : ''}
        {q.label}
        {'required' in q && q.required && <span className="text-[#d71920]"> *</span>}
      </div>
    );
    if (q.type === 'scale5') {
      return (
        <div key={q.id} ref={(el) => { refs.current[q.id] = el; }} className={req(q.id)}>
          {title}
          <table className="form-scale">
            <thead>
              <tr>
                {SCALE5_LABELS.map((l, i) => (
                  <th key={l}>
                    {i + 1}
                    <br />
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {SCALE5_LABELS.map((l, i) => (
                  <td key={l}>
                    <button type="button" onClick={() => set(q.id, i + 1)} aria-label={`${i + 1} - ${l}`} aria-pressed={answers[q.id] === i + 1}>
                      <Box on={answers[q.id] === i + 1} />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    if (q.type === 'nps') {
      return (
        <div key={q.id} ref={(el) => { refs.current[q.id] = el; }} className={req(q.id)}>
          {title}
          <table className="form-scale">
            <thead>
              <tr>
                {Array.from({ length: 11 }, (_, i) => (
                  <th key={i}>{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Array.from({ length: 11 }, (_, i) => (
                  <td key={i}>
                    <button type="button" onClick={() => set(q.id, i)} aria-label={`Nota ${i}`} aria-pressed={answers[q.id] === i}>
                      <Box on={answers[q.id] === i} />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="text-center italic text-[12.5px] mt-1.5">0 = nada provável | 10 = extremamente provável</div>
        </div>
      );
    }
    if (q.type === 'choice') {
      const v = answers[q.id];
      return (
        <div key={q.id} ref={(el) => { refs.current[q.id] = el; }}>
          <div className={req(q.id)}>
            {title}
            <div className="form-options">
              {q.options.map((o) => (
                <label key={o} className="form-option" onClick={() => set(q.id, o)}>
                  <Box on={v === o} />
                  <span>{o === q.otherOption ? 'Outro:' : o}</span>
                </label>
              ))}
              {q.otherOption && v === q.otherOption && (
                <input
                  className="border-b border-[#1d1d1b] text-[14px] px-1 py-1 min-w-[200px] flex-1 outline-none"
                  placeholder="Qual?"
                  autoFocus
                  value={String(answers[`${q.id}_outro`] || '')}
                  onChange={(e) => set(`${q.id}_outro`, e.target.value)}
                  maxLength={200}
                />
              )}
            </div>
          </div>
          {q.followUp && q.followUp.when.includes(String(v)) && (
            <>
              <div className="form-q">{q.followUp.label}</div>
              <textarea className="form-text" value={String(answers[q.followUp.id] || '')} onChange={(e) => set(q.followUp!.id, e.target.value)} maxLength={5000} />
            </>
          )}
        </div>
      );
    }
    return (
      <div key={q.id}>
        <div className="form-q">
          {n ? `${n}. ` : ''}
          {q.label}
        </div>
        <textarea className="form-text" value={String(answers[q.id] || '')} onChange={(e) => set(q.id, e.target.value)} maxLength={5000} />
      </div>
    );
  };

  const g = (k: keyof typeof general, label: string, type = 'text') => (
    <tr ref={(el) => { refs.current[`g_${k}`] = el as any; }} className={missing.has(`g_${k}`) ? 'form-error' : ''}>
      <th>{label}</th>
      <td>
        <input
          type={type}
          value={general[k]}
          onChange={(e) => {
            setGeneral((x) => ({ ...x, [k]: e.target.value }));
            setMissing((m) => {
              const n = new Set(m);
              n.delete(`g_${k}`);
              return n;
            });
          }}
          maxLength={255}
        />
      </td>
    </tr>
  );

  return (
    <div className="form-hummm py-0 sm:py-8">
      <div className="form-page">
        {header}
        <div className="px-5 sm:px-12 pb-4">
          <div className="mt-6 bg-[#fff6cf] border border-[#ffc20e] px-3 py-2 text-[13.5px] leading-snug">{SURVEY.objective}</div>

          <SectionBar n={1} title="INFORMAÇÕES GERAIS" />
          <table className="form-grid mt-3">
            <tbody>
              {g('unitName', 'Nome da unidade:')}
              {g('cityUf', 'Cidade / UF:')}
              {g('inaugurationDate', 'Data da inauguração:', 'date')}
              {g('franchiseeName', 'Nome do franqueado:')}
              <tr>
                <th>Data do preenchimento:</th>
                <td>{new Date(todayIso() + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
              </tr>
            </tbody>
          </table>

          <SectionBar n={2} title="ORIENTAÇÕES DE PREENCHIMENTO" />
          <p className="text-[14px] mt-3 leading-relaxed">{SURVEY.instructions}</p>

          {SURVEY.sections.map((s, i) => (
            <div key={s.id}>
              <SectionBar n={i + 3} title={s.title} />
              {s.questions.map(renderQuestion)}
            </div>
          ))}

          <p className="text-center font-bold text-[15px] mt-10">{SURVEY.thanks}</p>

          <div className="mt-6 mb-2 flex flex-col items-center gap-3">
            {submitError && <div className="text-[#d71920] text-[14px] font-semibold text-center">{submitError}</div>}
            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="inline-flex items-center gap-2 bg-[#d71920] hover:bg-[#b8151b] disabled:opacity-60 text-white font-bold text-[15px] px-8 h-12 rounded-lg"
            >
              {sending ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Enviando…' : 'Enviar pesquisa'}
            </button>
            <div className="text-[12px] text-[#666]">O link é individual e só pode ser enviado uma vez.</div>
          </div>
        </div>
        {footer}
      </div>
    </div>
  );
};
