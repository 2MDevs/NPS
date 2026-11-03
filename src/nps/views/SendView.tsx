import React, { useMemo, useState } from 'react';
import { Copy, MessageCircle, Mail, Plus, RefreshCw, Ban, Trash2, Pencil, Search, Link2, Eye } from 'lucide-react';
import { Invite, InviteInput, npsApi, fmtDate, fmtDateTime } from '../api';
import { Card, Modal, Empty, CategoryBadge } from '../ui';

const EMPTY: InviteInput = { unitName: '', cityUf: '', inaugurationDate: '', franchiseeName: '', franchiseeEmail: '', franchiseePhone: '' };

const STATUS = {
  pending: { label: 'Aguardando resposta', color: 'var(--nps-yellow)' },
  answered: { label: 'Respondida', color: 'var(--nps-green)' },
  canceled: { label: 'Cancelado', color: 'var(--nps-muted)' },
};

export function whatsappLink(inv: Invite) {
  const text = `Olá, ${inv.franchiseeName}! Aqui é da diretoria da Hummm! Pizzas. Queremos ouvir você sobre a implantação da unidade ${inv.unitName}. A pesquisa leva poucos minutos: ${inv.link}`;
  const phone = (inv.franchiseePhone || '').replace(/\D/g, '');
  const full = phone ? (phone.length <= 11 ? `55${phone}` : phone) : '';
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export const SendView: React.FC<{ invites: Invite[]; onChanged: () => void; toast: (m: string) => void; onOpenResponse: (inviteId: string) => void }> = ({
  invites,
  onChanged,
  toast,
  onOpenResponse,
}) => {
  const [form, setForm] = useState<InviteInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Invite | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered' | 'canceled'>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(
    () =>
      invites.filter(
        (i) =>
          (filter === 'all' || i.status === filter) &&
          (!q.trim() || `${i.unitName} ${i.franchiseeName} ${i.cityUf || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [invites, filter, q]
  );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
    setError('');
  };
  const openEdit = (i: Invite) => {
    setEditingId(i.id);
    setForm({
      unitName: i.unitName,
      cityUf: i.cityUf || '',
      inaugurationDate: i.inaugurationDate || '',
      franchiseeName: i.franchiseeName,
      franchiseeEmail: i.franchiseeEmail || '',
      franchiseePhone: i.franchiseePhone || '',
    });
    setError('');
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const saved = editingId ? await npsApi.updateInvite(editingId, form) : await npsApi.createInvite(form);
      setForm(null);
      if (!editingId) setCreated(saved);
      else toast('Dados atualizados.');
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (link: string | null) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado. Agora é só colar na conversa com o franqueado.');
    } catch {
      window.prompt('Copie o link:', link);
    }
  };

  const run = async (id: string, fn: () => Promise<any>, ok: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(id);
    try {
      const r = await fn();
      toast(r?.message || ok);
      onChanged();
      return r;
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(null);
    }
  };

  const field = (k: keyof InviteInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="nps-label">{label}</label>
      <input className="nps-input" value={form?.[k] || ''} onChange={(e) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))} {...props} />
    </div>
  );

  const ShareButtons: React.FC<{ inv: Invite }> = ({ inv }) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="nps-btn nps-btn-primary nps-btn-sm" onClick={() => copy(inv.link)}>
        <Copy className="w-4 h-4" /> Copiar link
      </button>
      <a className="nps-btn nps-btn-ghost nps-btn-sm" href={whatsappLink(inv)} target="_blank" rel="noreferrer">
        <MessageCircle className="w-4 h-4 text-[var(--nps-green)]" /> WhatsApp
      </a>
      <button
        type="button"
        className="nps-btn nps-btn-ghost nps-btn-sm"
        disabled={!inv.franchiseeEmail || busy === inv.id}
        title={inv.franchiseeEmail ? `Enviar para ${inv.franchiseeEmail}` : 'Cadastre o e-mail do franqueado'}
        onClick={() => run(inv.id, () => npsApi.sendEmail(inv.id), 'E-mail enviado.')}
      >
        <Mail className="w-4 h-4" /> E-mail
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[17px] font-bold">Como funciona</div>
            <p className="nps-muted text-[14px] mt-1 max-w-2xl">
              Cadastre a unidade e o franqueado para gerar um <strong>link individual</strong>. Envie pelo WhatsApp, por e-mail ou copie e cole. O franqueado
              responde sem precisar de login, uma única vez, e a resposta aparece aqui na hora.
            </p>
          </div>
          <button type="button" className="nps-btn nps-btn-primary h-12 px-6 text-[15px]" onClick={openNew}>
            <Plus className="w-5 h-5" /> Gerar link da pesquisa
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'answered', 'canceled'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`nps-btn nps-btn-sm ${filter === f ? 'nps-btn-primary' : 'nps-btn-ghost'}`}>
                {f === 'all' ? 'Todos' : STATUS[f].label} ({f === 'all' ? invites.length : invites.filter((i) => i.status === f).length})
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 nps-muted" />
            <input className="nps-input" style={{ paddingLeft: 36 }} placeholder="Buscar unidade ou franqueado" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {list.length === 0 ? (
          <Empty title={invites.length ? 'Nada encontrado com esse filtro' : 'Nenhum link gerado ainda'} text={invites.length ? undefined : 'Clique em “Gerar link da pesquisa” para começar.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="nps-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Franqueado</th>
                  <th>Situação</th>
                  <th>Gerado em</th>
                  <th>Nota</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="font-semibold">{i.unitName}</div>
                      <div className="nps-muted text-[12.5px]">
                        {i.cityUf || 'Cidade/UF a informar'} · Inauguração {fmtDate(i.inaugurationDate)}
                      </div>
                    </td>
                    <td>
                      <div>{i.franchiseeName}</div>
                      <div className="nps-muted text-[12.5px]">{[i.franchiseePhone, i.franchiseeEmail].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    <td>
                      <span className="nps-badge" style={{ background: `color-mix(in srgb, ${STATUS[i.status].color} 20%, transparent)` }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS[i.status].color }} />
                        {STATUS[i.status].label}
                      </span>
                      {i.status === 'pending' && <div className="nps-muted text-[12px] mt-1">{i.openedAt ? `Aberto em ${fmtDateTime(i.openedAt)}` : 'Ainda não abriu o link'}</div>}
                      {i.status === 'answered' && <div className="nps-muted text-[12px] mt-1">em {fmtDateTime(i.answeredAt)}</div>}
                    </td>
                    <td className="whitespace-nowrap">
                      <div>{fmtDate(i.createdAt)}</div>
                      <div className="nps-muted text-[12px]">{i.createdBy}</div>
                    </td>
                    <td>{i.status === 'answered' ? <CategoryBadge category={i.npsCategory} score={i.npsScore} /> : <span className="nps-muted">—</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {i.status === 'pending' && (
                          <>
                            <button type="button" className="nps-btn nps-btn-primary nps-btn-sm" onClick={() => copy(i.link)} title="Copiar link">
                              <Copy className="w-4 h-4" />
                            </button>
                            <a className="nps-btn nps-btn-ghost nps-btn-sm" href={whatsappLink(i)} target="_blank" rel="noreferrer" title="Enviar pelo WhatsApp">
                              <MessageCircle className="w-4 h-4 text-[var(--nps-green)]" />
                            </a>
                            <button
                              type="button"
                              className="nps-btn nps-btn-ghost nps-btn-sm"
                              title={i.franchiseeEmail ? 'Enviar por e-mail' : 'Cadastre o e-mail do franqueado'}
                              disabled={!i.franchiseeEmail || busy === i.id}
                              onClick={() => run(i.id, () => npsApi.sendEmail(i.id), 'E-mail enviado.')}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" title="Editar dados" onClick={() => openEdit(i)}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="nps-btn nps-btn-ghost nps-btn-sm"
                              title="Cancelar link"
                              disabled={busy === i.id}
                              onClick={() => run(i.id, () => npsApi.cancelInvite(i.id), 'Link cancelado.', `Cancelar o link de ${i.unitName}? O franqueado não conseguirá mais responder por ele.`)}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {i.status === 'answered' && (
                          <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" onClick={() => onOpenResponse(i.id)}>
                            <Eye className="w-4 h-4" /> Ver resposta
                          </button>
                        )}
                        {i.status !== 'answered' && (
                          <button
                            type="button"
                            className="nps-btn nps-btn-ghost nps-btn-sm"
                            title="Gerar link novo (o atual deixa de funcionar)"
                            disabled={busy === i.id}
                            onClick={async () => {
                              const r = await run(i.id, () => npsApi.newLink(i.id), 'Novo link gerado. O anterior não funciona mais.', 'Gerar um link novo? O link enviado antes deixa de funcionar.');
                              if (r) setCreated(r);
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {i.status !== 'answered' && (
                          <button
                            type="button"
                            className="nps-btn nps-btn-ghost nps-btn-sm"
                            title="Excluir"
                            disabled={busy === i.id}
                            onClick={() => run(i.id, () => npsApi.deleteInvite(i.id), 'Excluído.', `Excluir o link de ${i.unitName}?`)}
                          >
                            <Trash2 className="w-4 h-4 text-[var(--nps-red)]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && (
        <Modal
          title={editingId ? 'Editar dados do link' : 'Gerar link da pesquisa'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" className="nps-btn nps-btn-ghost" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="button" className="nps-btn nps-btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Gerar link'}
              </button>
            </>
          }
        >
          <p className="nps-muted text-[13.5px] mb-4">
            Esses dados já aparecem preenchidos para o franqueado em “Informações gerais” (ele pode corrigir). Telefone e e-mail servem só para enviar o link.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">{field('unitName', 'Nome da unidade *', { placeholder: 'Ex.: Unidade Centro', autoFocus: true })}</div>
            {field('cityUf', 'Cidade / UF', { placeholder: 'Ex.: São Paulo / SP' })}
            {field('inaugurationDate', 'Data da inauguração', { type: 'date' })}
            <div className="sm:col-span-2">{field('franchiseeName', 'Nome do franqueado *')}</div>
            {field('franchiseePhone', 'WhatsApp do franqueado', { placeholder: '(11) 99999-9999', inputMode: 'tel' })}
            {field('franchiseeEmail', 'E-mail do franqueado', { type: 'email' })}
          </div>
          {error && <div className="mt-4 text-[14px] font-semibold text-[var(--nps-red)]">{error}</div>}
        </Modal>
      )}

      {created && (
        <Modal title="Link pronto para enviar" onClose={() => setCreated(null)}>
          <div className="space-y-4">
            <p className="text-[14px]">
              Envie para <strong>{created.franchiseeName}</strong> ({created.unitName}). O link é individual e vale para uma única resposta.
            </p>
            <div className="nps-input h-auto py-3 flex items-center gap-2 break-all text-[13px]">
              <Link2 className="w-4 h-4 shrink-0 text-[var(--nps-yellow)]" />
              {created.link}
            </div>
            <ShareButtons inv={created} />
          </div>
        </Modal>
      )}
    </div>
  );
};
