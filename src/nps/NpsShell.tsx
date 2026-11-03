import React, { useEffect, useRef, useState } from 'react';
import {
  Home,
  Send,
  ClipboardList,
  BarChart3,
  ClipboardCheck,
  Store,
  Download,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  UserCog,
  Laptop,
  ScrollText,
  Server,
  Plug,
  Pizza,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../types';
import { useTheme } from '../services/theme';
import { HummmLogo } from './ui';

export type NpsTab =
  | 'dashboard'
  | 'send'
  | 'responses'
  | 'indicators'
  | 'actions'
  | 'units'
  | 'reports'
  | 'account'
  | 'users'
  | 'devices'
  | 'audit'
  | 'system'
  | 'integrations';

export const TAB_PATH: Record<NpsTab, string> = {
  dashboard: '/painel',
  send: '/enviar',
  responses: '/respostas',
  indicators: '/indicadores',
  actions: '/planos-de-acao',
  units: '/unidades',
  reports: '/relatorios',
  account: '/seguranca',
  users: '/usuarios',
  devices: '/dispositivos',
  audit: '/auditoria',
  system: '/sistema',
  integrations: '/integracao',
};
export const PATH_TAB: Record<string, NpsTab> = Object.fromEntries(Object.entries(TAB_PATH).map(([k, v]) => [v, k as NpsTab]));
export const TAB_TITLE: Record<NpsTab, string> = {
  dashboard: 'Dashboard',
  send: 'Enviar Pesquisa',
  responses: 'Respostas',
  indicators: 'Indicadores',
  actions: 'Planos de Ação',
  units: 'Unidades',
  reports: 'Relatórios',
  account: 'Minha conta e segurança',
  users: 'Usuários da diretoria',
  devices: 'Dispositivos',
  audit: 'Auditoria',
  system: 'Sistema',
  integrations: 'Integração',
};
export const SETTINGS_TABS: NpsTab[] = ['account', 'users', 'devices', 'audit', 'system', 'integrations'];

const MAIN: Array<[NpsTab, React.ComponentType<{ className?: string }>]> = [
  ['dashboard', Home],
  ['send', Send],
  ['responses', ClipboardList],
  ['indicators', BarChart3],
  ['actions', ClipboardCheck],
  ['units', Store],
  ['reports', Download],
];
const SETTINGS: Array<[NpsTab, React.ComponentType<{ className?: string }>, boolean]> = [
  ['account', ShieldCheck, false],
  ['users', UserCog, false],
  ['audit', ScrollText, false],
  ['system', Server, false],
  ['devices', Laptop, true],
  ['integrations', Plug, true],
];

const ROLE_LABEL: Record<string, string> = { DIRECTOR: 'Diretoria', DEVELOPER: 'TI - Desenvolvedor' };
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

interface Props {
  currentUser: User;
  activeTab: NpsTab;
  onSelect: (tab: NpsTab) => void;
  onLogout: () => void;
  notifications: Array<{ id: string; title: string; message: string }>;
  onNotificationClick: () => void;
  offline?: boolean;
  setupBanner?: React.ReactNode;
  children: React.ReactNode;
}

export const NpsShell: React.FC<Props> = ({ currentUser, activeTab, onSelect, onLogout, notifications, onNotificationClick, offline, setupBanner, children }) => {
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(SETTINGS_TABS.includes(activeTab));
  const [userMenu, setUserMenu] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const isDev = currentUser.role === 'DEVELOPER';
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (SETTINGS_TABS.includes(activeTab)) setSettingsOpen(true);
  }, [activeTab]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (t: NpsTab) => {
    onSelect(t);
    setNavOpen(false);
  };

  const sidebar = (
    <aside className="w-[260px] h-full bg-[var(--nps-sidebar)] text-white flex flex-col border-r border-white/5">
      <div className="px-6 pt-7 pb-6 flex items-center justify-between">
        <button type="button" onClick={() => pick('dashboard')} aria-label="Ir para o Dashboard">
          <HummmLogo onDark className="h-12 w-auto" />
        </button>
        <button type="button" className="lg:hidden p-2 rounded-lg hover:bg-white/10" onClick={() => setNavOpen(false)} aria-label="Fechar menu">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 -mt-3 mb-4 text-[12px] tracking-[0.18em] font-semibold text-[var(--nps-yellow)]">NPS · FRANQUEADOS</div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {MAIN.map(([tab, Icon]) => (
          <button key={tab} type="button" className={`nps-nav-item ${activeTab === tab ? 'active' : ''}`} onClick={() => pick(tab)}>
            <Icon className="w-5 h-5 shrink-0" />
            {TAB_TITLE[tab]}
          </button>
        ))}
        <button type="button" className={`nps-nav-item ${SETTINGS_TABS.includes(activeTab) && !settingsOpen ? 'active' : ''}`} onClick={() => setSettingsOpen((v) => !v)}>
          <Settings className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left">Configurações</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>
        {settingsOpen && (
          <div className="pl-4 space-y-0.5">
            {SETTINGS.filter(([, , devOnly]) => !devOnly || isDev).map(([tab, Icon]) => (
              <button key={tab} type="button" className={`nps-nav-item !py-2 !text-[14px] ${activeTab === tab ? 'active' : ''}`} onClick={() => pick(tab)}>
                <Icon className="w-4 h-4 shrink-0" />
                {TAB_TITLE[tab].replace(' da diretoria', '').replace('Minha conta e segurança', 'Minha conta')}
              </button>
            ))}
          </div>
        )}
      </nav>
      <div className="p-4 space-y-4">
        <div className="relative rounded-2xl border border-white/10 p-4 overflow-hidden">
          <Pizza className="absolute -right-2 -top-2 w-14 h-14 text-[var(--nps-yellow)] opacity-90" strokeWidth={1.5} />
          <div className="text-[17px] font-bold leading-snug pr-8">
            Juntos fazemos uma rede ainda <span className="text-[var(--nps-yellow)]">mais forte!</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Sun className="w-4 h-4 text-[var(--nps-yellow)]" />
          <button
            type="button"
            onClick={toggle}
            className="w-12 h-6 rounded-full bg-[var(--nps-yellow)] relative"
            aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${theme === 'dark' ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
          <Moon className="w-4 h-4 text-white/70" />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="nps-app h-[100dvh] flex overflow-hidden">
      <div className="hidden lg:block shrink-0 nps-no-print">{sidebar}</div>
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex nps-no-print">
          <div className="h-full">{sidebar}</div>
          <button type="button" className="flex-1 bg-black/60" onClick={() => setNavOpen(false)} aria-label="Fechar menu" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {setupBanner}
        {offline && (
          <div className="bg-[var(--nps-red)] text-white text-[13px] px-4 py-2">Sem conexão com o servidor. Alterações ficam bloqueadas até a conexão voltar.</div>
        )}
        <header className="h-[72px] shrink-0 flex items-center justify-between gap-3 px-4 sm:px-8 nps-no-print" ref={menuRef}>
          <button type="button" className="lg:hidden nps-btn nps-btn-ghost w-11 px-0" onClick={() => setNavOpen(true)} aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden">
            <HummmLogo className="h-8 w-auto" />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <button type="button" className="relative w-11 h-11 rounded-full hover:bg-[var(--nps-panel-2)] flex items-center justify-center" onClick={() => setBellOpen((v) => !v)} aria-label="Notificações">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--nps-red)] text-white text-[11px] font-bold flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 nps-card p-2 z-50 shadow-2xl">
                  {notifications.length === 0 && <div className="p-3 text-[14px] nps-muted">Nenhuma notificação.</div>}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="w-full text-left p-3 rounded-xl hover:bg-[var(--nps-panel-2)]"
                      onClick={() => {
                        setBellOpen(false);
                        onNotificationClick();
                      }}
                    >
                      <div className="font-semibold text-[14px]">{n.title}</div>
                      <div className="nps-muted text-[13px]">{n.message}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden sm:block w-px h-9 bg-[var(--nps-border)]" />
            <div className="relative">
              <button type="button" className="flex items-center gap-3 rounded-full pr-2 hover:opacity-90" onClick={() => setUserMenu((v) => !v)}>
                <span className="w-11 h-11 rounded-full bg-[var(--nps-yellow)] text-[#1d1d1b] font-bold flex items-center justify-center">{initials(currentUser.name)}</span>
                <span className="hidden sm:block text-left">
                  <span className="block text-[14px] font-semibold leading-tight">{currentUser.name}</span>
                  <span className="flex items-center gap-1 text-[12.5px] nps-muted">
                    {ROLE_LABEL[currentUser.role] || currentUser.role} <ChevronDown className="w-3.5 h-3.5" />
                  </span>
                </span>
              </button>
              {userMenu && (
                <div className="absolute right-0 mt-2 w-56 nps-card p-2 z-50 shadow-2xl">
                  <button type="button" className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--nps-panel-2)] text-[14px] flex items-center gap-2" onClick={() => { setUserMenu(false); onSelect('account'); }}>
                    <ShieldCheck className="w-4 h-4" /> Minha conta
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--nps-panel-2)] text-[14px] flex items-center gap-2" onClick={toggle}>
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Tema {theme === 'dark' ? 'claro' : 'escuro'}
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--nps-panel-2)] text-[14px] flex items-center gap-2 text-[var(--nps-red)]" onClick={onLogout}>
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pb-10 pt-2">{children}</main>
      </div>
    </div>
  );
};
