# NPS · Hummm! Pizzas

Pesquisa de Satisfação do Franqueado (Pós-Inauguração) com painel da diretoria.

- **Diretoria** (perfil Diretor) e **TI** (perfil Desenvolvedor) entram na área logada. Outros perfis veem "Acesso restrito à diretoria".
- O **diretor gera um link individual** por franqueado (tela *Enviar Pesquisa*) e envia por WhatsApp, e-mail ou copiando.
- O **franqueado responde sem login**, uma única vez, num formulário com o mesmo desenho do formulário oficial em Word.
- A resposta aparece na hora no *Dashboard*, em *Respostas*, *Indicadores*, *Unidades* e *Planos de Ação*.
- Base padrão dos projetos (mesma do DocSecure): login do desenvolvedor, 2FA por e-mail, dispositivos confiáveis, bloqueio por inatividade com PIN, auditoria, telas **Sistema** e **Integração** e botão **Atualizar sistema**.

## Telas

| Menu | O que faz |
| :--- | :--- |
| Dashboard | NPS da rede (velocímetro), promotores/neutros/detratores com comparação ao período anterior, evolução mensal, nota por unidade, pontos de atenção (média 1–5 de cada seção em %), últimas pesquisas e ações recomendadas. Filtro de período: 3, 6, 12, 24 meses ou tudo. |
| Enviar Pesquisa | Gerar link (unidade, cidade/UF, inauguração, franqueado, WhatsApp, e-mail). Copiar, WhatsApp, e-mail, editar, cancelar, gerar link novo (o anterior para de funcionar) e excluir (só não respondidos). Mostra se o franqueado já abriu o link. |
| Respostas | Lista das pesquisas respondidas com filtro por classificação. Abre a resposta completa e o **"13. Uso interno — tratamento da pesquisa"** (responsável, data da análise, plano de ação, prazo de retorno, observações). |
| Indicadores | Distribuição das notas 0–10, média por pergunta e por seção, contagem das perguntas de múltipla escolha. |
| Planos de Ação | Respostas aguardando análise (detratores primeiro) e respostas com plano de ação. |
| Unidades | Nota de cada unidade (resposta mais recente), classificação e média 1–5. |
| Relatórios | Planilha (.csv para Excel) com todas as respostas e o tratamento. |
| Configurações | Minha conta, Usuários, Auditoria, Sistema (recursos da plataforma, servidor, API & Webhooks, artefatos da plataforma) e, só para o desenvolvedor, Dispositivos e Integração. |

Link do franqueado: `https://SEU-DOMINIO/pesquisa/<código>` (o domínio vem de `APP_URL`).

**Cálculo do NPS:** % promotores (9–10) − % detratores (0–6), de −100 a 100.

## Instalação na VPS (primeira vez)

> A VPS é compartilhada: nada aqui altera outros projetos. Use uma porta livre e um banco só do NPS.

```bash
# 1. Banco de dados (PostgreSQL já existente na VPS)
sudo -u postgres psql -c "CREATE USER nps_user WITH PASSWORD 'TROQUE_A_SENHA';"
sudo -u postgres psql -c "CREATE DATABASE nps_db OWNER nps_user;"

# 2. Código
cd /var/www   # ou a pasta onde ficam os seus projetos
git clone https://github.com/2MDevs/NPS.git nps && cd nps
cp .env.example .env && nano .env      # preencha (veja a tabela abaixo)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # cole em SETTINGS_ENCRYPTION_KEY

# 3. Instalar, compilar e iniciar
npm install
npm run build
pm2 start npm --name nps -- start

# 4. Botão "Atualizar sistema" (uma vez, como root)
sudo RESTART_CMD="pm2 restart nps" bash scripts/install-auto-update.sh
```

Depois, aponte o domínio/subdomínio no Nginx para a porta do NPS (`PORT`).

## Variáveis (.env)

| Variável | Para que serve | Padrão |
| :--- | :--- | :--- |
| `DATABASE_URL` | Conexão do PostgreSQL | — (obrigatória) |
| `SETTINGS_ENCRYPTION_KEY` | Chave AES-256-GCM dos segredos (SMTP, Gemini) | — (obrigatória) |
| `DEVELOPER_EMAILS` | E-mails com perfil Desenvolvedor (TI) | — |
| `PORT` | Porta do sistema | `3000` |
| `NODE_ENV` | `production` na VPS | — |
| `APP_URL` | Endereço público (usado nos links enviados ao franqueado) | — |
| `SESSION_TTL_HOURS` | Validade da sessão | `8` |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | Primeiro acesso (troca de senha obrigatória) | — |
| `SMTP_*` | E-mail (2FA e envio do link). Também pela tela Integração | — |
| `GEMINI_API_KEY` | Opcional | — |

Prioridade das configurações: **Banco (tela Integração) > .env > padrão**.

## Primeiros passos

1. Entre com `ADMIN_EMAIL` (perfil Desenvolvedor) e troque a senha.
2. **Integração**: configure o SMTP e envie o e-mail de teste (ativa o 2FA).
3. **Configurações › Usuários**: cadastre os diretores com o perfil **Diretor**, setor **Diretoria**.
4. O diretor entra, vai em **Enviar Pesquisa › Gerar link da pesquisa** e envia ao franqueado.

## Segurança do formulário público

- Link com código aleatório de 192 bits; uma resposta por link (trava no banco com `FOR UPDATE`).
- Limite de 60 acessos por IP a cada 15 minutos.
- Respostas validadas no servidor com as mesmas regras do formulário (`shared/survey.ts`).
- Envio registrado na Auditoria como `NPS_RESPONSE_SUBMITTED`.

## Roteiro de testes

- [ ] Gerar um link, abrir em aba anônima: dados da unidade já preenchidos.
- [ ] Tentar enviar faltando perguntas: as obrigatórias ficam em vermelho.
- [ ] Responder "Parcialmente" na pergunta 5 e "Sim" na 7 e 11: aparecem os campos de texto.
- [ ] Marcar "Outro" na pergunta 13: pede qual sistema.
- [ ] Enviar: aparece "Pesquisa enviada!"; abrir o link de novo: "já foi respondida".
- [ ] Dashboard atualiza sozinho; a unidade aparece em Unidades.
- [ ] Abrir a resposta, preencher o tratamento e salvar; ela sai de "Aguardando análise".
- [ ] Cancelar um link e tentar abrir: "link foi cancelado". Gerar link novo: o antigo para de funcionar.
- [ ] Baixar a planilha em Relatórios e abrir no Excel.
- [ ] Entrar com um usuário que não é Diretor: "Acesso restrito à diretoria".

Para sugerir melhorias, anote: o que fez, o que esperava, o que aconteceu e um print.

---
Desenvolvido por Marcos Monteiro · TI - Hummm! Pizzas
