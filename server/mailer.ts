import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { getEffectiveSetting } from './services/systemSettings';

dotenv.config();

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

/**
 * Monta o link único e padronizado para definição ou redefinição de senha:
 * ${baseUrl}/definir-senha?token=<token>
 */
export function buildPasswordLink(token: string, reqBaseUrl?: string): string {
  const baseUrl = process.env.APP_URL || reqBaseUrl || 'http://localhost:3000';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/definir-senha?token=${encodeURIComponent(token)}`;
}

export async function getDynamicTransporter() {
  const host = (await getEffectiveSetting('SMTP_HOST')).value;
  const portStr = (await getEffectiveSetting('SMTP_PORT')).value;
  const secureStr = (await getEffectiveSetting('SMTP_SECURE')).value;
  const user = (await getEffectiveSetting('SMTP_USER')).value;
  const pass = (await getEffectiveSetting('SMTP_PASS')).value;

  const isConfigured = Boolean(host && user && pass);
  if (!isConfigured) return null;

  const port = parseInt(portStr || '587', 10);
  const secure = secureStr === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Envia código numérico de 2FA por e-mail corporativo com aviso anti-spam e alta entregabilidade.
 */
export async function send2FACode(email: string, nome: string, codigo: string, isFirstAccess?: boolean): Promise<boolean> {
  const masked = maskEmail(email);
  const transporter = await getDynamicTransporter();

  // Ambiente de desenvolvimento sem SMTP configurado
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[MAILER ERROR] Servidor SMTP não configurado no ambiente de produção.');
      return false;
    }

    // Permitido exclusivamente em desenvolvimento quando SMTP não configurado
    console.log(`[DEV MAILER] (Sem SMTP configurado) Código 2FA para ${masked}: ${codigo}`);
    return true;
  }

  const fromAddress = (await getEffectiveSetting('SMTP_FROM')).value || 'NPS - Hummm! Pizzas <nao-responda@hummmpizzas.com.br>';

  const subjectTitle = isFirstAccess
    ? `[NPS] Código de Confirmação do Primeiro Acesso: ${codigo}`
    : `[NPS] Código de Verificação em Duas Etapas: ${codigo}`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${subjectTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDF8CF; color: #1D1D1B; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #F6D35C; border-radius: 16px; padding: 32px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
        .logo { font-size: 20px; font-weight: bold; color: #EA3324; letter-spacing: 0.5px; margin-bottom: 24px; text-transform: uppercase; }
        .title { font-size: 22px; font-weight: 700; color: #1D1D1B; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #3f3f3c; margin-bottom: 24px; }
        .code-box { background: #FDF8CF; border: 1px solid #EA3324; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1D1D1B; }
        .expiry { font-size: 12px; color: #6b6b66; text-align: center; margin-top: 8px; }
        .spam-box { font-size: 12px; color: #3f3f3c; background-color: #FDF8CF; border: 1px dashed #d9cf8a; border-radius: 8px; padding: 12px; margin: 20px 0; line-height: 1.5; }
        .warning { font-size: 12px; color: #B42318; border-top: 1px solid #eee6b0; padding-top: 18px; margin-top: 20px; line-height: 1.5; }
        .footer { text-align: center; font-size: 11px; color: #6b6b66; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">hummm! PIZZAS · NPS</div>
        <div class="title">${isFirstAccess ? 'Confirmação de Primeiro Acesso' : 'Código de Verificação em Duas Etapas'}</div>
        <div class="text">
          Olá, <strong>${nome || 'Colaborador'}</strong>.<br>
          ${isFirstAccess
            ? 'Para concluir a ativação da sua conta e validar o seu e-mail corporativo, utilize o código de segurança abaixo:'
            : 'Detectamos uma tentativa de login em um novo dispositivo. Utilize o código de segurança abaixo para autorizar o seu acesso:'}
        </div>
        
        <div class="code-box">
          <div class="code">${codigo}</div>
          <div class="expiry">Válido por 10 minutos</div>
        </div>

        <div class="spam-box">
          <strong>💡 Dica contra Spam:</strong> Adicione o remetente <code>${fromAddress}</code> aos seus contatos confiáveis. Se esta mensagem caiu na pasta de Spam ou Lixo Eletrônico, marque-a como <em>"Não é spam"</em> para garantir a entrega rápida dos próximos acessos.
        </div>

        <div class="warning">
          <strong>Atenção:</strong> Se você não realizou esta tentativa de login, ignore este e-mail imediatamente e altere sua senha de acesso. Nenhum colaborador do NPS solicitará este código.
        </div>
      </div>
      <div class="footer">
        Hummm! Pizzas • TI - Tecnologia da Informação
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: subjectTitle,
      text: `Olá ${nome}, seu código de acesso ao NPS é: ${codigo}. Válido por 10 minutos. Caso não encontre nossos e-mails, verifique a pasta de Spam ou Lixo Eletrônico e adicione ${fromAddress} aos seus contatos.`,
      html,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      },
    });
    console.log(`[MAILER] Código de verificação 2FA enviado com sucesso para ${masked}.`);
    return true;
  } catch (error: any) {
    console.error(`[MAILER ERROR] Falha ao enviar e-mail 2FA para ${masked}:`, error.message);
    return false;
  }
}

/**
 * Envia e-mail para redefinição ou primeiro acesso de senha.
 */
export async function sendPasswordResetEmail(
  email: string,
  nome: string,
  resetUrl: string
): Promise<boolean> {
  const masked = maskEmail(email);
  const transporter = await getDynamicTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[MAILER ERROR] Servidor SMTP não configurado para redefinição de senha.');
      return false;
    }
    console.log(`[DEV MAILER] Link de redefinição para ${masked}: ${resetUrl}`);
    return true;
  }

  const fromAddress = (await getEffectiveSetting('SMTP_FROM')).value || 'NPS - Hummm! Pizzas <nao-responda@hummmpizzas.com.br>';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>[NPS] Definição de Senha de Acesso</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDF8CF; color: #1D1D1B; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #F6D35C; border-radius: 16px; padding: 32px; }
        .logo { font-size: 20px; font-weight: bold; color: #EA3324; margin-bottom: 24px; text-transform: uppercase; }
        .title { font-size: 22px; font-weight: 700; color: #1D1D1B; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #3f3f3c; margin-bottom: 24px; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; margin: 16px 0; }
        .spam-box { font-size: 12px; color: #3f3f3c; background-color: #FDF8CF; border: 1px dashed #d9cf8a; border-radius: 8px; padding: 12px; margin: 20px 0; line-height: 1.5; }
        .warning { font-size: 12px; color: #6b6b66; border-top: 1px solid #eee6b0; padding-top: 18px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">hummm! PIZZAS · NPS</div>
        <div class="title">Definição / Redefinição de Senha</div>
        <div class="text">
          Olá, <strong>${nome || 'Colaborador'}</strong>.<br>
          Recebemos uma solicitação para cadastrar ou redefinir a sua senha de acesso na plataforma NPS.
        </div>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="btn">Definir Nova Senha</a>
        </div>
        <div class="text" style="font-size: 12px; color: #6b6b66;">
          Este link é de uso único e expira em 1 hora.<br>
          Se o botão não funcionar, copie e cole o endereço no seu navegador: <br>
          <span style="color: #1D1D1B; word-break: break-all;">${resetUrl}</span>
        </div>
        <div class="spam-box">
          <strong>💡 Dica contra Spam:</strong> Adicione <code>${fromAddress}</code> aos seus contatos confiáveis ou verifique a pasta de Lixo Eletrônico/Spam caso não localize os e-mails na caixa principal.
        </div>
        <div class="warning">
          Se você não solicitou este link, desconsidere esta mensagem com segurança.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: '[NPS] Instruções para Definição de Senha',
      text: `Olá ${nome}, utilize o link a seguir para definir sua senha (válido por 1 hora): ${resetUrl}. Se não encontrar nossos e-mails, confira a pasta de Spam.`,
      html,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      },
    });
    console.log(`[MAILER] E-mail de redefinição de senha enviado para ${masked}.`);
    return true;
  } catch (error: any) {
    console.error(`[MAILER ERROR] Falha ao enviar redefinição de senha para ${masked}:`, error.message);
    return false;
  }
}

/**
 * Envia e-mail de teste para validar a configuração SMTP (usado na tela Integração)
 */
export async function sendTestEmail(targetEmail: string, developerName: string): Promise<{ success: boolean; message: string }> {
  const transporter = await getDynamicTransporter();
  if (!transporter) {
    return {
      success: false,
      message: 'Configurações SMTP incompletas. Preencha Servidor (Host), Usuário e Senha.',
    };
  }

  const fromAddress = (await getEffectiveSetting('SMTP_FROM')).value || 'NPS - Hummm! Pizzas <nao-responda@hummmpizzas.com.br>';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Teste de Conexão SMTP - NPS</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDF8CF; color: #1D1D1B; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #EA3324; border-radius: 16px; padding: 32px; }
        .logo { font-size: 20px; font-weight: bold; color: #EA3324; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: 700; color: #1D1D1B; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #3f3f3c; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">hummm! PIZZAS · NPS</div>
        <div class="title">✅ Conexão SMTP Estabelecida com Sucesso!</div>
        <div class="text">
          Olá, <strong>${developerName}</strong>.<br><br>
          Este é um e-mail de teste disparado pelo painel de Integração do NPS.
          As credenciais e conexões do servidor SMTP estão funcionando perfeitamente.
          <br><br>
          <em>Data e Hora do Envio: ${new Date().toLocaleString('pt-BR')}</em>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: fromAddress,
      to: targetEmail,
      subject: 'NPS - Teste de Envio SMTP Concluído com Sucesso',
      text: `Olá ${developerName}, o teste de conexão SMTP do NPS foi concluído com sucesso em ${new Date().toLocaleString('pt-BR')}.`,
      html,
    });
    return { success: true, message: `E-mail de teste enviado com sucesso para ${targetEmail}.` };
  } catch (error: any) {
    // Retorna a mensagem de erro do servidor SMTP sem expor a senha
    return {
      success: false,
      message: `Erro retornado pelo servidor SMTP: ${error.message || 'Falha na autenticação ou timeout de conexão.'}`,
    };
  }
}

/**
 * Envia as credenciais de acesso (senha provisória) para um usuário recém-cadastrado
 * ou para um usuário cujo acesso foi reenviado pelo administrador.
 * No primeiro login o sistema exige a troca dessa senha.
 */
export async function sendAccessCredentialsEmail(
  email: string,
  nome: string,
  temporaryPassword: string,
  loginUrl: string,
  isResend = false
): Promise<boolean> {
  const masked = maskEmail(email);
  const transporter = await getDynamicTransporter();

  if (!transporter) {
    console.error(`[MAILER ERROR] Servidor SMTP não configurado. Credenciais de ${masked} não foram enviadas.`);
    return false;
  }

  const fromAddress = (await getEffectiveSetting('SMTP_FROM')).value || 'NPS - Hummm! Pizzas <nao-responda@hummmpizzas.com.br>';
  const escape = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const safeName = escape(nome || 'Colaborador');
  const title = isResend ? 'Nova senha provisória de acesso' : 'Bem-vindo(a) ao NPS';
  const intro = isResend
    ? 'O administrador gerou uma nova senha provisória para a sua conta na plataforma NPS.'
    : 'Sua conta na plataforma NPS foi criada. Use os dados abaixo para fazer o seu primeiro acesso.';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>[NPS] ${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Poppins, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FDF8CF; color: #1D1D1B; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #F6D35C; border-radius: 16px; padding: 32px; }
        .logo { font-size: 20px; font-weight: bold; color: #EA3324; margin-bottom: 24px; text-transform: uppercase; }
        .title { font-size: 22px; font-weight: 700; color: #1D1D1B; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #3f3f3c; margin-bottom: 20px; }
        .cred { background-color: #FDF8CF; border: 1px solid #F6D35C; border-radius: 10px; padding: 16px; margin: 16px 0; font-size: 14px; color: #3f3f3c; }
        .cred strong { color: #ffffff; }
        .pass { font-family: 'Courier New', monospace; font-size: 20px; letter-spacing: 2px; color: #1D1D1B; font-weight: bold; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; margin: 8px 0 16px; }
        .warning { font-size: 12px; color: #6b6b66; border-top: 1px solid #eee6b0; padding-top: 18px; margin-top: 24px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">hummm! PIZZAS · NPS</div>
        <div class="title">${title}</div>
        <div class="text">Olá, <strong>${safeName}</strong>.<br>${intro}</div>
        <div class="cred">
          <div>Usuário: <strong>${escape(email)}</strong></div>
          <div style="margin-top: 10px;">Senha provisória:</div>
          <div class="pass">${escape(temporaryPassword)}</div>
        </div>
        <div style="text-align: center;">
          <a href="${loginUrl}" class="btn">Acessar o NPS</a>
        </div>
        <div class="text" style="font-size: 13px;">
          Ao entrar, você receberá um código de verificação por e-mail e, em seguida, o sistema pedirá que você
          <strong>crie uma nova senha pessoal</strong>. A senha provisória deixa de funcionar após a troca.
        </div>
        <div class="warning">
          Não compartilhe esta senha com ninguém. Caso não reconheça este cadastro, ignore esta mensagem
          e avise o administrador do sistema. Se não encontrar nossos e-mails, verifique a pasta de Spam.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: isResend ? '[NPS] Nova senha provisória de acesso' : '[NPS] Seus dados de acesso',
      text:
        `Olá ${nome || 'Colaborador'}, ${intro}\n\n` +
        `Usuário: ${email}\nSenha provisória: ${temporaryPassword}\nAcesse: ${loginUrl}\n\n` +
        'No primeiro acesso o sistema pedirá que você crie uma nova senha pessoal.',
      html,
    });
    console.log(`[MAILER] Credenciais de acesso enviadas para ${masked}.`);
    return true;
  } catch (error: any) {
    console.error(`[MAILER ERROR] Falha ao enviar credenciais para ${masked}:`, error.message);
    return false;
  }
}

/** Envia ao franqueado o link individual da Pesquisa de Satisfação (Pós-Inauguração) */
export async function sendSurveyInviteEmail(
  targetEmail: string,
  franchiseeName: string,
  unitName: string,
  link: string,
  senderName: string
): Promise<{ success: boolean; message: string }> {
  const transporter = await getDynamicTransporter();
  if (!transporter) {
    return { success: false, message: 'O e-mail do sistema ainda não foi configurado (tela Integração). Copie o link e envie pelo WhatsApp.' };
  }
  const fromAddress = (await getEffectiveSetting('SMTP_FROM')).value || 'NPS - Hummm! Pizzas <nao-responda@hummmpizzas.com.br>';
  const esc = (v: string) => String(v || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Pesquisa de Satisfação - Hummm! Pizzas</title></head>
  <body style="margin:0;padding:24px;background:#f4f4f2;font-family:Poppins,'Segoe UI',Roboto,Arial,sans-serif;color:#1D1D1B">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e6e0">
      <div style="background:#1D1D1B;padding:22px 28px">
        <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">hummm<span style="color:#F6D35C">!</span> <span style="font-size:12px;color:#EA3324;letter-spacing:2px">PIZZAS</span></div>
      </div>
      <div style="height:6px;background:linear-gradient(90deg,#EA3324 0 60%,#F6D35C 60% 100%)"></div>
      <div style="padding:28px">
        <div style="font-size:20px;font-weight:800;color:#D71920;margin-bottom:4px">PESQUISA DE SATISFAÇÃO</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:18px">Franqueado - Pós-Inauguração</div>
        <p style="font-size:14px;line-height:1.6;margin:0 0 14px">Olá, <strong>${esc(franchiseeName)}</strong>.</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 14px">A diretoria da Hummm! Pizzas quer ouvir você sobre a implantação da unidade <strong>${esc(unitName)}</strong>. Leva poucos minutos e ajuda a melhorar as próximas inaugurações da rede.</p>
        <div style="text-align:center;margin:26px 0">
          <a href="${link}" style="display:inline-block;background:#D71920;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px">Responder a pesquisa</a>
        </div>
        <p style="font-size:12px;line-height:1.5;color:#6b6b66;margin:0">O link é individual e pode ser respondido uma única vez. Se o botão não abrir, copie e cole no navegador:<br><span style="word-break:break-all;color:#1D1D1B">${link}</span></p>
        <p style="font-size:12px;color:#6b6b66;margin:18px 0 0">Enviado por ${esc(senderName)} · Diretoria Hummm! Pizzas</p>
      </div>
      <div style="background:#FFF6CF;padding:12px 28px;font-size:11px;color:#6b6b66;text-align:center">Hummm! Pizzas | Implantação e Melhoria Contínua</div>
    </div>
  </body></html>`;
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: targetEmail,
      subject: `Hummm! Pizzas - Pesquisa de Satisfação do Franqueado (${unitName})`,
      text: `Olá ${franchiseeName}, responda a Pesquisa de Satisfação do Franqueado - Pós-Inauguração da unidade ${unitName}: ${link}`,
      html,
    });
    return { success: true, message: `Link enviado para ${targetEmail}.` };
  } catch (error: any) {
    return { success: false, message: `O servidor de e-mail recusou o envio: ${error.message || 'falha na conexão.'}` };
  }
}
