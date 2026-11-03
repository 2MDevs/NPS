/**
 * Pesquisa de Satisfação do Franqueado — Pós-Inauguração.
 * Texto idêntico ao formulário oficial em Word (Implantação e Melhoria Contínua).
 * Usado pelo formulário público (navegador) e pelo servidor (validação e relatórios).
 */

export type ScaleQuestion = { id: string; type: 'scale5'; label: string; required: true };
export type NpsQuestion = { id: string; type: 'nps'; label: string; required: true };
export type ChoiceQuestion = {
  id: string;
  type: 'choice';
  label: string;
  options: string[];
  required: true;
  /** Opção que abre um campo "Outro: ____" */
  otherOption?: string;
  /** Mostra o campo de texto seguinte só quando a resposta for uma destas */
  followUp?: { when: string[]; id: string; label: string };
};
export type TextQuestion = { id: string; type: 'text'; label: string; required?: boolean };
export type Question = ScaleQuestion | NpsQuestion | ChoiceQuestion | TextQuestion;

export type Section = { id: string; title: string; questions: Question[] };

export const SCALE5_LABELS = ['Muito insatisfeito', 'Insatisfeito', 'Regular', 'Satisfeito', 'Muito satisfeito'];

const comments = (id: string): TextQuestion => ({ id, type: 'text', label: 'Comentários / observações:' });

export const SURVEY = {
  id: 'pos-inauguracao',
  title: 'PESQUISA DE SATISFAÇÃO',
  subtitle: 'Franqueado - Pós-Inauguração',
  headerTag: 'PESQUISA DE SATISFAÇÃO DO FRANQUEADO',
  footer: 'Hummm! Pizzas  |  Implantação e Melhoria Contínua  |  Uso interno',
  objective:
    'Objetivo: avaliar a experiência do franqueado durante todo o processo de implantação da unidade e identificar oportunidades de melhoria para as próximas inaugurações.',
  instructions:
    'Para as perguntas de avaliação, marque uma opção de 1 a 5. Utilize os campos de comentários para registrar exemplos, fornecedores, atrasos ou situações relevantes.',
  thanks: 'Obrigado por contribuir para a evolução da rede Hummm! Pizzas.',
  sections: [
    {
      id: 's3',
      title: 'COMUNICAÇÃO E ACOMPANHAMENTO',
      questions: [
        { id: 'q1', type: 'scale5', required: true, label: 'Como você avalia a comunicação da equipe de Implantação durante todo o processo?' },
        { id: 'q2', type: 'scale5', required: true, label: 'As informações fornecidas foram claras, completas e objetivas?' },
        { id: 'q3', type: 'scale5', required: true, label: 'O tempo de resposta da equipe atendeu às suas expectativas?' },
        comments('c3'),
      ],
    },
    {
      id: 's4',
      title: 'CRONOGRAMA DE IMPLANTAÇÃO',
      questions: [
        { id: 'q4', type: 'scale5', required: true, label: 'O cronograma apresentado foi realista e permitiu organizar as etapas da implantação?' },
        {
          id: 'q5',
          type: 'choice',
          required: true,
          label: 'Você conseguiu cumprir os prazos estabelecidos?',
          options: ['Sim', 'Parcialmente', 'Não'],
          followUp: { when: ['Parcialmente', 'Não'], id: 'q5_motivos', label: 'Caso tenha respondido "Parcialmente" ou "Não", informe os principais motivos:' },
        },
      ],
    },
    {
      id: 's5',
      title: 'PROJETOS E OBRA CIVIL',
      questions: [
        { id: 'q6', type: 'scale5', required: true, label: 'Como você avalia a qualidade dos projetos arquitetônico e complementares?' },
        {
          id: 'q7',
          type: 'choice',
          required: true,
          label: 'Houve dificuldade na interpretação ou execução dos projetos?',
          options: ['Não', 'Sim'],
          followUp: { when: ['Sim'], id: 'q7_dificuldades', label: 'Em caso positivo, descreva as principais dificuldades:' },
        },
        { id: 'q8', type: 'scale5', required: true, label: 'O suporte recebido durante a obra foi satisfatório?' },
        { id: 'q8_desafios', type: 'text', label: 'Quais foram os maiores desafios encontrados na obra?' },
      ],
    },
    {
      id: 's6',
      title: 'EQUIPAMENTOS, MOBILIÁRIO E FORNECEDORES',
      questions: [
        { id: 'q9', type: 'scale5', required: true, label: 'Os equipamentos e mobiliários homologados atenderam às expectativas?' },
        {
          id: 'q10',
          type: 'choice',
          required: true,
          label: 'Os fornecedores indicados cumpriram os prazos acordados?',
          options: ['Sempre', 'Na maioria das vezes', 'Poucas vezes', 'Não cumpriram'],
        },
        {
          id: 'q11',
          type: 'choice',
          required: true,
          label: 'Houve equipamento, mobiliário ou fornecedor que gerou problemas?',
          options: ['Não', 'Sim'],
          followUp: { when: ['Sim'], id: 'q11_descricao', label: 'Descreva o item, fornecedor e problema identificado:' },
        },
      ],
    },
    {
      id: 's7',
      title: 'SISTEMAS',
      questions: [
        { id: 'q12', type: 'scale5', required: true, label: 'A implantação e configuração dos sistemas ocorreram de forma satisfatória?' },
        {
          id: 'q13',
          type: 'choice',
          required: true,
          label: 'Qual sistema apresentou maior dificuldade?',
          options: ['Nenhum', 'Internet', 'SAIPOS', 'Delivery', 'Máquina de cartão', 'Totem', 'Outro'],
          otherOption: 'Outro',
        },
        comments('c7'),
      ],
    },
    {
      id: 's8',
      title: 'COMPRAS, UTENSÍLIOS E SUPRIMENTOS',
      questions: [
        { id: 'q14', type: 'choice', required: true, label: 'A lista de compras foi suficiente para a inauguração?', options: ['Sim', 'Parcialmente', 'Não'] },
        { id: 'q14_faltaram', type: 'text', label: 'Quais itens importantes faltaram?' },
        { id: 'q14_dispensaveis', type: 'text', label: 'Houve itens comprados que poderiam ser dispensáveis? Quais?' },
      ],
    },
    {
      id: 's9',
      title: 'RECRUTAMENTO E SELEÇÃO DA EQUIPE',
      questions: [
        { id: 'q15', type: 'scale5', required: true, label: 'Como você avalia o recrutamento e seleção da equipe para a inauguração?' },
        { id: 'q16', type: 'choice', required: true, label: 'O Quadro de pessoal projetado para inauguração foi adequado?', options: ['Sim', 'Parcialmente', 'Não'] },
        comments('c9'),
      ],
    },
    {
      id: 's10',
      title: 'TREINAMENTO E PREPARAÇÃO DA EQUIPE',
      questions: [
        { id: 'q17', type: 'scale5', required: true, label: 'Como você avalia o treinamento recebido antes da inauguração?' },
        { id: 'q18', type: 'choice', required: true, label: 'Sua equipe iniciou a operação preparada?', options: ['Sim', 'Parcialmente', 'Não'] },
        comments('c10'),
      ],
    },
    {
      id: 's11',
      title: 'SUPORTE NA INAUGURAÇÃO',
      questions: [
        { id: 'q19', type: 'scale5', required: true, label: 'Como você avalia o suporte da franqueadora durante os primeiros dias de operação?' },
        { id: 'q20', type: 'scale5', required: true, label: 'O suporte recebido trouxe segurança para iniciar a operação?' },
        comments('c11'),
      ],
    },
    {
      id: 's12',
      title: 'AVALIAÇÃO GERAL E NPS',
      questions: [
        {
          id: 'nps',
          type: 'nps',
          required: true,
          label: 'Em uma escala de 0 a 10, qual a probabilidade de você recomendar o processo de implantação da Hummm! Pizzas a um novo franqueado?',
        },
        { id: 'q22', type: 'text', label: 'Quais foram os pontos mais positivos do processo?' },
        { id: 'q23', type: 'text', label: 'Quais etapas precisam ser melhoradas?' },
        { id: 'q24', type: 'text', label: 'Se pudesse alterar apenas uma coisa no processo de implantação, qual seria?' },
        { id: 'q25', type: 'text', label: 'Deixe outras sugestões para a equipe de Implantação:' },
      ],
    },
  ] as Section[],
};

/** Número de exibição de cada pergunta (texto livre de acompanhamento não conta) */
export function questionNumbers(): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 0;
  for (const s of SURVEY.sections)
    for (const q of s.questions) {
      if (q.type !== 'text' || q.label.startsWith('Quais foram os pontos') || q.label.startsWith('Quais etapas') || q.label.startsWith('Se pudesse') || q.label.startsWith('Deixe outras')) {
        map[q.id] = ++n;
      }
    }
  return map;
}

export function allQuestions(): Question[] {
  return SURVEY.sections.flatMap((s) => s.questions);
}

export function npsCategory(score: number): 'detrator' | 'neutro' | 'promotor' {
  if (score >= 9) return 'promotor';
  if (score >= 7) return 'neutro';
  return 'detrator';
}

/** NPS = % promotores − % detratores (de −100 a 100) */
export function computeNps(scores: number[]): number | null {
  if (!scores.length) return null;
  const p = scores.filter((s) => s >= 9).length;
  const d = scores.filter((s) => s <= 6).length;
  return Math.round(((p - d) / scores.length) * 100);
}

export type Answers = Record<string, string | number>;

/** Confere a resposta e devolve a lista de erros (vazia = ok) */
export function validateAnswers(answers: Answers): string[] {
  const errors: string[] = [];
  const nums = questionNumbers();
  for (const q of allQuestions()) {
    const v = answers[q.id];
    const label = nums[q.id] ? `Pergunta ${nums[q.id]}` : q.label;
    if (q.type === 'scale5') {
      if (!(typeof v === 'number' && v >= 1 && v <= 5 && Number.isInteger(v))) errors.push(`${label}: escolha uma nota de 1 a 5.`);
    } else if (q.type === 'nps') {
      if (!(typeof v === 'number' && v >= 0 && v <= 10 && Number.isInteger(v))) errors.push(`${label}: escolha uma nota de 0 a 10.`);
    } else if (q.type === 'choice') {
      if (typeof v !== 'string' || !q.options.includes(v)) errors.push(`${label}: escolha uma opção.`);
      else if (q.otherOption && v === q.otherOption && !String(answers[`${q.id}_outro`] || '').trim()) errors.push(`${label}: informe qual é o outro sistema.`);
    } else if (q.type === 'text' && v !== undefined && typeof v !== 'string') {
      errors.push(`${q.label}: resposta inválida.`);
    }
  }
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === 'string' && v.length > 5000) errors.push('Uma das respostas passou de 5.000 caracteres.');
    if (!/^[a-z0-9_]{1,40}$/.test(k)) errors.push('Campo desconhecido no formulário.');
  }
  return errors;
}

/** Média das notas de 1 a 5 */
export function satisfactionAverage(answers: Answers): number | null {
  const vals = allQuestions()
    .filter((q) => q.type === 'scale5')
    .map((q) => answers[q.id])
    .filter((v): v is number => typeof v === 'number');
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
}
