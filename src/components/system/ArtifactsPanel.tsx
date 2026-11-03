import React from 'react';
import { FileText, Link2, Users, ShieldCheck, BarChart3 } from 'lucide-react';

/**
 * Aba "Artefatos da plataforma": o documento do que o NPS faz (resumo da documentação do projeto).
 */
const Item: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
      <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">{icon}</span>
      {title}
    </div>
    <div className="mt-3 text-[13px] leading-relaxed text-slate-600 space-y-2">{children}</div>
  </section>
);

export const ArtifactsPanel: React.FC = () => (
  <div className="space-y-4">
    <Item icon={<FileText className="w-4 h-4" />} title="O que é o NPS">
      <p>
        Sistema da Hummm! Pizzas para a diretoria medir a satisfação dos franqueados com a implantação da unidade (Pesquisa de Satisfação do Franqueado —
        Pós-Inauguração). Repositório: <strong>2MDevs/NPS</strong>.
      </p>
    </Item>
    <Item icon={<Users className="w-4 h-4" />} title="Quem usa">
      <p>Diretoria (perfil Diretor) e TI (perfil Desenvolvedor). Outros perfis não acessam a área logada.</p>
      <p>O franqueado não tem login: responde pelo link individual enviado pela diretoria.</p>
    </Item>
    <Item icon={<Link2 className="w-4 h-4" />} title="Como funciona">
      <p>1. Em “Enviar Pesquisa”, o diretor cadastra a unidade e o franqueado e gera o link (endereço /pesquisa/código).</p>
      <p>2. Envia por WhatsApp, e-mail (SMTP da tela Integração) ou copia e cola.</p>
      <p>3. O franqueado responde uma única vez; o link pode ser cancelado ou trocado por um novo enquanto não for respondido.</p>
      <p>4. A diretoria acompanha o Dashboard, as respostas e registra o “Uso interno — tratamento da pesquisa”.</p>
    </Item>
    <Item icon={<BarChart3 className="w-4 h-4" />} title="Cálculos">
      <p>NPS = % de promotores (nota 9-10) − % de detratores (0-6), de −100 a 100. Neutros: 7-8.</p>
      <p>Pontos de atenção: média das notas de 1 a 5 de cada seção, mostrada em % (média ÷ 5).</p>
    </Item>
    <Item icon={<ShieldCheck className="w-4 h-4" />} title="Segurança">
      <p>Mesma base do DocSecure: 2FA por e-mail, dispositivos confiáveis, bloqueio por inatividade com PIN, auditoria de todas as ações (inclusive envio da resposta pelo franqueado) e limite de tentativas no formulário público.</p>
    </Item>
  </div>
);
