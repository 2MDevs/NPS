import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react';
import { User, Department, Device, AuditLog, ApiKey, WebhookConfig } from './types';
import { createAuditEntry } from './services/securityEngine';
import { apiClient, dispatchSessionExpired, SESSION_LOCKED_EVENT, SESSION_UNLOCKED_EVENT } from './services/apiClient';
import type { UpdateNotice } from './services/apiClient';
import { UPDATE_CHECK_EVENT } from './components/settings/SystemUpdatePanel';
import { isNewVersionAvailable } from './services/appVersion';
import { startConnectivityMonitor, useConnectionStatus } from './services/connectivity';
import { UpdateNoticeDialog } from './components/common/UpdateNoticeDialog';
import { LoginView } from './components/auth/LoginView';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DeviceApprovalModal } from './components/auth/DeviceApprovalModal';
import { AccessDeniedModal } from './components/common/AccessDeniedModal';
import { UsersManagement } from './components/users/UsersManagement';
import { DevicesManagement } from './components/devices/DevicesManagement';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { SystemView } from './components/system/SystemView';
import { AccountSecurity } from './components/settings/AccountSecurity';
import { IntegrationsView } from './components/settings/IntegrationsView';
import { LockScreen } from './components/auth/LockScreen';
import { PublicSurveyPage } from './pages/PublicSurveyPage';
import { NpsShell, NpsTab, TAB_PATH, PATH_TAB, TAB_TITLE, SETTINGS_TABS } from './nps/NpsShell';
import { npsApi, Invite, Summary } from './nps/api';
import { PageHeader, Loading, ErrorBox, Toast, HummmLogo } from './nps/ui';
import { DashboardView, GoTab } from './nps/views/DashboardView';
import { SendView } from './nps/views/SendView';
import { ResponseDetailModal } from './nps/views/ResponseDetail';
import { ResponsesView, IndicatorsView, ActionPlansView, UnitsView, ReportsView } from './nps/views/OtherViews';
import './nps/nps.css';

const VERSION_CHECK_EVENT = 'nps:version-check';
/** Só a diretoria (e o desenvolvedor) usam a área logada */
const ALLOWED_ROLES = ['DIRECTOR', 'DEVELOPER'];
const DEV_ONLY: NpsTab[] = ['devices', 'integrations'];

const SUBTITLES: Partial<Record<NpsTab, string>> = {
  dashboard: 'Acompanhe a satisfação da nossa rede e identifique oportunidades de melhoria.',
  send: 'Gere o link individual da pesquisa e envie para o franqueado.',
  responses: 'Todas as pesquisas respondidas pelos franqueados.',
  indicators: 'Notas por pergunta e por seção da pesquisa.',
  actions: 'Respostas para analisar e planos de ação em andamento.',
  units: 'Nota de cada unidade que respondeu a pesquisa.',
  reports: 'Exporte as respostas para Excel ou imprima.',
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Formulário público do franqueado: abre sem login e sem carregar nada da área logada
  const publicMatch = location.pathname.match(/^\/pesquisa\/([A-Za-z0-9_-]+)\/?$/);
  if (publicMatch) return <PublicSurveyPage token={publicMatch[1]} />;

  return <AuthenticatedApp navigate={navigate} location={location} searchParams={searchParams} />;
}

function AuthenticatedApp({ navigate, location, searchParams }: { navigate: ReturnType<typeof useNavigate>; location: ReturnType<typeof useLocation>; searchParams: URLSearchParams }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [pendingDeviceUser, setPendingDeviceUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [dbStatus, setDbStatus] = useState<any>({ connected: true, databaseName: 'nps_db', host: 'localhost', port: 5432, tablesCount: 0, recordsCount: 0, latencyMs: 0, mode: 'POSTGRESQL_REAL' });
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [initialSetupMode, setInitialSetupMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [securityPolicy, setSecurityPolicy] = useState<{ lockIdleMinutes: number; hasPin: boolean }>({ lockIdleMinutes: 0, hasPin: false });
  const [accessDenied, setAccessDenied] = useState<{ isOpen: boolean; reason: string; resourceName: string }>({ isOpen: false, reason: '', resourceName: '' });
  const [updateNotice, setUpdateNotice] = useState<UpdateNotice | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [newVersionReady, setNewVersionReady] = useState(false);

  // Dados do NPS
  const [months, setMonths] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('nps.months') || 12);
    } catch {
      return 12;
    }
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [npsError, setNpsError] = useState('');
  const [openResponse, setOpenResponse] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeTab: NpsTab = PATH_TAB[location.pathname] || 'dashboard';
  const canUse = Boolean(currentUser && ALLOWED_ROLES.includes(String(currentUser.role).toUpperCase()));
  const connectionStatus = useConnectionStatus();

  useEffect(() => {
    startConnectivityMonitor();
  }, []);

  // ------------------------------------------------------------ carga de dados
  const loadBootstrapData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setIsLoadingInitialData(true);
      const data: any = await apiClient.getBootstrapData();
      if (data) {
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (Array.isArray(data.users)) setUsers(data.users);
        if (Array.isArray(data.departments)) setDepartments(data.departments);
        if (Array.isArray(data.devices)) setDevices(data.devices);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (Array.isArray(data.apiKeys)) setApiKeys(data.apiKeys);
        if (Array.isArray(data.webhooks)) setWebhooks(data.webhooks);
        if (data.dbStatus) setDbStatus(data.dbStatus);
        if (data.initialSetupMode !== undefined) setInitialSetupMode(Boolean(data.initialSetupMode));
      }
    } catch (err: any) {
      console.warn('[Bootstrap]', err?.message);
    } finally {
      if (!options?.silent) setIsLoadingInitialData(false);
    }
  }, []);

  const loadNps = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([npsApi.summary(months), npsApi.invites()]);
      setSummary(s);
      setInvites(i);
      setNpsError('');
    } catch (e: any) {
      setNpsError(e?.message || 'Não foi possível carregar os dados do NPS.');
    }
  }, [months]);

  useEffect(() => {
    if (canUse && !currentUser?.mustChangePassword && !isLocked) loadNps();
  }, [canUse, currentUser?.mustChangePassword, isLocked, loadNps]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getMe();
        if (res?.user) {
          setCurrentUser(res.user);
          if (res.sessionLocked) setIsLocked(true);
          await loadBootstrapData();
          return;
        }
      } catch {}
      setCurrentUser(null);
      setIsLoadingInitialData(false);
    })();
  }, [loadBootstrapData]);

  // ------------------------------------------------------------ bloqueio por inatividade (PIN)
  useEffect(() => {
    if (!currentUser?.id || currentUser.mustChangePassword) return;
    apiClient
      .getSecurityPolicy()
      .then((p: any) => {
        setSecurityPolicy({ lockIdleMinutes: p.lockIdleMinutes, hasPin: p.hasPin });
        if (p.sessionLocked) setIsLocked(true);
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.mustChangePassword]);

  const lockNow = useCallback(() => {
    setIsLocked(true);
    setOpenResponse(null);
    try {
      localStorage.setItem('ds.lockedAt', String(Date.now()));
    } catch {}
    apiClient.lockSession().catch(() => {});
  }, []);

  const handleUnlocked = () => {
    setIsLocked(false);
    window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
    try {
      localStorage.setItem('ds.unlockedAt', String(Date.now()));
      localStorage.setItem('ds.lastActivity', String(Date.now()));
    } catch {}
    loadBootstrapData({ silent: true });
  };

  useEffect(() => {
    if (!currentUser?.id || currentUser.mustChangePassword || isLocked || securityPolicy.lockIdleMinutes <= 0) return;
    let last = Date.now();
    let lastWrite = 0;
    const touch = () => {
      last = Date.now();
      if (last - lastWrite > 5000) {
        lastWrite = last;
        try {
          localStorage.setItem('ds.lastActivity', String(last));
        } catch {}
      }
    };
    touch();
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const interval = setInterval(() => {
      let shared = 0;
      try {
        shared = Number(localStorage.getItem('ds.lastActivity') || 0);
      } catch {}
      if (Date.now() - Math.max(last, shared) > securityPolicy.lockIdleMinutes * 60_000) lockNow();
    }, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.mustChangePassword, isLocked, securityPolicy.lockIdleMinutes, lockNow]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ds.lockedAt' && currentUser) setIsLocked(true);
      if (e.key === 'ds.unlockedAt') {
        setIsLocked(false);
        window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
        loadBootstrapData({ silent: true });
      }
    };
    const onLocked = () => currentUser && setIsLocked(true);
    window.addEventListener('storage', onStorage);
    window.addEventListener(SESSION_LOCKED_EVENT, onLocked);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SESSION_LOCKED_EVENT, onLocked);
    };
  }, [currentUser, loadBootstrapData]);

  // ------------------------------------------------------------ atualização do sistema (GitHub)
  useEffect(() => {
    if (!currentUser?.id || isLocked || connectionStatus !== 'online') return;
    let cancelled = false;
    const check = () =>
      apiClient
        .getUpdateNotice()
        .then((n) => !cancelled && setUpdateNotice(n))
        .catch(() => {});
    check();
    const timer = window.setInterval(check, 2 * 60 * 1000);
    window.addEventListener(UPDATE_CHECK_EVENT, check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(UPDATE_CHECK_EVENT, check);
    };
  }, [currentUser?.id, isLocked, connectionStatus]);

  // App instalado (PWA): recarrega sozinho quando sai versão nova
  const busyRef = useRef(false);
  busyRef.current = Boolean(openResponse);
  useEffect(() => {
    let checking = false;
    const check = async (resumed: boolean) => {
      if (checking) return;
      checking = true;
      try {
        if (await isNewVersionAvailable()) {
          if (resumed && !busyRef.current) window.location.reload();
          else setNewVersionReady(true);
        }
      } finally {
        checking = false;
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && check(true);
    const onServerBack = () => check(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(VERSION_CHECK_EVENT, onServerBack);
    const timer = window.setInterval(() => check(false), 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(VERSION_CHECK_EVENT, onServerBack);
      window.clearInterval(timer);
    };
  }, []);

  // ------------------------------------------------------------ tempo real: nova resposta aparece na hora
  useEffect(() => {
    if (!currentUser?.id || currentUser.mustChangePassword || typeof EventSource === 'undefined') return;
    let t: ReturnType<typeof setTimeout> | null = null;
    let ready = 0;
    const refresh = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        loadBootstrapData({ silent: true });
        if (canUse) loadNps();
      }, 300);
    };
    const source = new EventSource('/api/events', { withCredentials: true });
    source.addEventListener('changed', refresh);
    source.addEventListener('update', () => window.dispatchEvent(new Event(UPDATE_CHECK_EVENT)));
    source.addEventListener('session', async () => {
      try {
        const res = await apiClient.getMe();
        if (!res?.user) throw new Error('sessão');
        refresh();
      } catch {
        dispatchSessionExpired('Sua sessão foi encerrada por uma alteração de segurança. Entre novamente.');
      }
    });
    source.addEventListener('ready', () => {
      ready += 1;
      if (ready > 1) {
        refresh();
        window.dispatchEvent(new Event(UPDATE_CHECK_EVENT));
        window.setTimeout(() => window.dispatchEvent(new Event(VERSION_CHECK_EVENT)), 1500);
      }
    });
    return () => {
      source.close();
      if (t) clearTimeout(t);
    };
  }, [currentUser?.id, currentUser?.mustChangePassword, canUse, loadBootstrapData, loadNps]);

  // ------------------------------------------------------------ sessão
  const logSecurityEvent = async (user: User | null, action: any, resourceName: string, details: string, result: 'SUCCESS' | 'DENIED' | 'BLOCKED') => {
    const entry = createAuditEntry(user, action, resourceName, details, result, auditLogs[0]?.hash);
    setAuditLogs((prev) => [entry, ...prev]);
    try {
      await apiClient.recordAuditLog(entry);
    } catch {}
  };

  const handleSessionExpired = useCallback(
    (msg?: string) => {
      setCurrentUser(null);
      setSessionExpiredNotice(msg || 'Sua sessão expirou por inatividade. Entre novamente para continuar.');
      setSummary(null);
      setInvites([]);
      const redirect = location.pathname !== '/login' ? location.pathname + location.search : '';
      navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login');
    },
    [location.pathname, location.search, navigate]
  );

  useEffect(() => {
    const on = (e: Event) => handleSessionExpired((e as CustomEvent)?.detail?.message);
    window.addEventListener('nps:session-expired', on);
    return () => window.removeEventListener('nps:session-expired', on);
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!currentUser) return;
    const check = async () => {
      try {
        const res = await apiClient.getMe();
        if (!res?.user) handleSessionExpired();
      } catch (err: any) {
        const m = err?.message || '';
        if (m.includes('401') || m.includes('Sessão') || m.includes('expirou')) handleSessionExpired();
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [currentUser, handleSessionExpired]);

  // ------------------------------------------------------------ rotas
  const homePath = initialSetupMode && currentUser?.role === 'DEVELOPER' ? '/integracao' : '/painel';
  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('reset_token');
    if (location.pathname === '/reset-password' || searchParams.has('reset_token')) navigate(`/definir-senha?token=${token || ''}`, { replace: true });
  }, [location.pathname, searchParams, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    if (location.pathname === '/' || location.pathname === '/login') {
      const r = searchParams.get('redirect');
      navigate(location.pathname === '/login' && r && r.startsWith('/') ? r : homePath, { replace: true });
    }
  }, [currentUser, location.pathname, searchParams, homePath, navigate]);

  useEffect(() => {
    if (currentUser?.mustChangePassword && location.pathname !== '/definir-senha') navigate('/definir-senha?troca_obrigatoria=true', { replace: true });
  }, [currentUser, location.pathname, navigate]);

  useEffect(() => {
    if (isLoadingInitialData || currentUser) return;
    if (!['/login', '/definir-senha', '/reset-password'].includes(location.pathname)) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [currentUser, isLoadingInitialData, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!currentUser || !PATH_TAB[location.pathname]) return;
    if (DEV_ONLY.includes(PATH_TAB[location.pathname]) && currentUser.role !== 'DEVELOPER') {
      setAccessDenied({ isOpen: true, reason: 'Esta área é exclusiva do desenvolvedor (TI).', resourceName: location.pathname });
      navigate('/painel', { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  const completeLogin = (user: User, isSetupMode?: boolean, mustChangePassword?: boolean) => {
    setCurrentUser(user);
    setSessionExpiredNotice(null);
    if (isSetupMode !== undefined) setInitialSetupMode(Boolean(isSetupMode));
    loadBootstrapData();
    logSecurityEvent(user, 'LOGIN', 'Sessão Web Segura', `Login efetuado com sucesso por ${user.name}.`, 'SUCCESS');
    if (mustChangePassword || user.mustChangePassword) return navigate('/definir-senha?troca_obrigatoria=true');
    const r = searchParams.get('redirect');
    navigate(r && r.startsWith('/') ? r : user.role === 'DEVELOPER' && isSetupMode ? '/integracao' : '/painel');
  };

  const handleLogout = async () => {
    setIsLocked(false);
    try {
      await apiClient.logout();
    } catch {}
    if (currentUser) logSecurityEvent(currentUser, 'LOGOUT', 'Sessão Web', 'Sessão encerrada pelo usuário.', 'SUCCESS');
    setCurrentUser(null);
    navigate('/login');
  };

  // ------------------------------------------------------------ usuários, dispositivos e chaves (base padrão)
  const handleCreateUser = async (d: any) => {
    const dept = departments.find((x) => x.id === d.departmentId) || departments.find((x) => x.id === 'dept-diretoria') || departments[0];
    const created = await apiClient.createUser({
      name: d.name,
      email: d.email,
      matricula: d.matricula || 'MAT-000',
      cpf: d.cpf,
      role: d.role || 'DIRECTOR',
      departmentId: dept?.id || 'dept-diretoria',
      departmentName: dept?.name || 'Diretoria',
      cargo: d.cargo || 'Diretor(a)',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      twoFactorEnabled: d.twoFactorEnabled ?? true,
      createdAt: new Date().toISOString(),
      permittedFolderIds: [],
      granularPermissions: {},
    } as any);
    const { emailSent, temporaryPassword, ...saved } = created as any;
    setUsers((prev) => [saved as User, ...prev]);
    return { emailSent: Boolean(emailSent), temporaryPassword };
  };
  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    const saved = await apiClient.updateUser(userId, updates);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...saved } : u)));
    if (currentUser?.id === userId) setCurrentUser((p) => (p ? { ...p, ...saved } : p));
  };
  const handleDeleteUser = async (userId: string) => {
    await apiClient.deleteUser(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };
  const handleResendAccess = async (userId: string) => {
    const r = await apiClient.resendUserAccess(userId);
    return { emailSent: r.emailSent, temporaryPassword: r.temporaryPassword };
  };
  const handleToggleUserStatus = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const next = target.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: next } : u)));
    try {
      await apiClient.updateUser(userId, { status: next });
    } catch {}
  };
  const setDeviceStatus = async (deviceId: string, status: 'TRUSTED' | 'BLOCKED') => {
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, status } : d)));
    try {
      await apiClient.updateDeviceStatus(deviceId, status);
    } catch {}
  };
  const handleRevokeDevice = async (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    try {
      await apiClient.revokeDevice(deviceId);
    } catch {}
  };
  const handleCreateApiKey = async (name: string, scopes: string[]): Promise<string> => {
    const created: any = await apiClient.createApiKey(name, scopes);
    const { fullKey, ...key } = created;
    setApiKeys((prev) => [key as ApiKey, ...prev.filter((k) => k.id !== key.id)]);
    if (!fullKey) throw new Error('O servidor não devolveu a chave. Tente novamente.');
    return fullKey;
  };
  const handleRevokeApiKey = async (keyId: string) => {
    await apiClient.revokeApiKey(keyId).catch((e: any) => setToast(e.message));
    setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: 'REVOKED' } : k)));
  };
  const handleDeleteApiKey = async (keyId: string) => {
    await apiClient.deleteApiKey(keyId).catch((e: any) => setToast(e.message));
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };
  const handleCreateWebhook = async (name: string, url: string, events: string[]) => {
    try {
      await apiClient.createWebhook(name, url, events);
      loadBootstrapData({ silent: true });
    } catch (e: any) {
      setToast(e.message);
    }
  };

  const notifications = useMemo(() => {
    if (!updateNotice?.updateAvailable || !updateNotice.commit) return [];
    const changes = updateNotice.changes || [];
    return [{ id: `update-${updateNotice.commit}`, title: 'Nova atualização disponível', message: changes[0]?.title || 'Melhorias e correções' }];
  }, [updateNotice]);

  // ------------------------------------------------------------ telas
  if (location.pathname === '/definir-senha') {
    return (
      <SetPasswordPage
        currentUser={currentUser}
        onPasswordChangeSuccess={(u) => {
          setCurrentUser(u);
          navigate('/painel');
        }}
      />
    );
  }

  if (isLoadingInitialData && !currentUser) {
    return (
      <div className="nps-app min-h-[100dvh] flex flex-col items-center justify-center gap-5 bg-[#1d1d1b]">
        <HummmLogo onDark className="h-14 w-auto" />
        <div className="flex items-center gap-2 text-[#fdf8cf] text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" /> Carregando o NPS…
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView
          onLoginSuccess={completeLogin}
          availableUsers={users}
          onRequestDeviceApproval={(u) => setPendingDeviceUser(u)}
          sessionExpiredNotice={sessionExpiredNotice}
          onClearSessionExpiredNotice={() => setSessionExpiredNotice(null)}
        />
        <DeviceApprovalModal
          isOpen={!!pendingDeviceUser}
          user={pendingDeviceUser}
          currentDevice={{ deviceName: 'Novo dispositivo', os: '', ipAddress: '', fingerprintHash: '' }}
          onApproveByAdmin={() => {
            if (pendingDeviceUser) completeLogin(pendingDeviceUser);
            setPendingDeviceUser(null);
          }}
          onCancel={() => setPendingDeviceUser(null)}
        />
      </>
    );
  }

  if (!canUse) {
    return (
      <div className="nps-app min-h-[100dvh] flex items-center justify-center p-6 bg-[#1d1d1b]">
        <div className="nps-card max-w-md w-full p-8 text-center">
          <HummmLogo className="h-12 w-auto mx-auto" />
          <ShieldAlert className="w-10 h-10 mx-auto mt-6 text-[var(--nps-red)]" />
          <h1 className="text-[20px] font-bold mt-3">Acesso restrito à diretoria</h1>
          <p className="nps-muted text-[14px] mt-2">O NPS é usado apenas pela diretoria da Hummm! Pizzas. Se você precisa de acesso, fale com a TI.</p>
          <button type="button" className="nps-btn nps-btn-primary mt-6" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  const known = Boolean(PATH_TAB[location.pathname]) || ['/', '/login', '/reset-password'].includes(location.pathname);
  if (!known) return <NotFoundPage currentUser={currentUser} />;

  const go = (tab: NpsTab | GoTab) => navigate(TAB_PATH[tab as NpsTab]);
  const isSettings = SETTINGS_TABS.includes(activeTab);
  const needsSummary = ['dashboard', 'indicators', 'units'].includes(activeTab);

  const periodSelect = (
    <select
      className="nps-input w-auto h-11 pr-8 font-medium"
      value={months}
      onChange={(e) => {
        const v = Number(e.target.value);
        setMonths(v);
        try {
          localStorage.setItem('nps.months', String(v));
        } catch {}
      }}
      aria-label="Período"
    >
      <option value={3}>Últimos 3 meses</option>
      <option value={6}>Últimos 6 meses</option>
      <option value={12}>Últimos 12 meses</option>
      <option value={24}>Últimos 24 meses</option>
      <option value={0}>Todo o histórico</option>
    </select>
  );

  let content: React.ReactNode;
  if (!isSettings && npsError && !summary) content = <ErrorBox message={npsError} onRetry={loadNps} />;
  else if (!isSettings && needsSummary && !summary) content = <Loading />;
  else if (activeTab === 'dashboard') content = <DashboardView summary={summary!} onGo={go} />;
  else if (activeTab === 'send') content = <SendView invites={invites} onChanged={loadNps} toast={setToast} onOpenResponse={setOpenResponse} />;
  else if (activeTab === 'responses') content = <ResponsesView invites={invites} onOpen={setOpenResponse} />;
  else if (activeTab === 'indicators') content = <IndicatorsView summary={summary!} />;
  else if (activeTab === 'actions') content = <ActionPlansView invites={invites} onOpen={setOpenResponse} />;
  else if (activeTab === 'units') content = <UnitsView summary={summary!} onOpen={setOpenResponse} />;
  else if (activeTab === 'reports') content = <ReportsView summary={summary} />;
  else {
    const base =
      activeTab === 'account' ? (
        <AccountSecurity
          currentUser={currentUser}
          onLockNow={lockNow}
          onPinChanged={(hasPin) => {
            setSecurityPolicy((p) => ({ ...p, hasPin }));
            setCurrentUser((u) => (u ? { ...u, hasPin } : u));
          }}
        />
      ) : activeTab === 'users' ? (
        <UsersManagement
          currentUser={currentUser}
          users={users}
          departments={departments}
          onCreateUser={handleCreateUser}
          onResendAccess={handleResendAccess}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onToggleUserStatus={handleToggleUserStatus}
          onReset2FA={() => setToast('Verificação em duas etapas redefinida.')}
        />
      ) : activeTab === 'devices' ? (
        <DevicesManagement
          currentUser={currentUser}
          devices={devices}
          onApproveDevice={(id) => setDeviceStatus(id, 'TRUSTED')}
          onBlockDevice={(id) => setDeviceStatus(id, 'BLOCKED')}
          onRevokeDevice={handleRevokeDevice}
        />
      ) : activeTab === 'audit' ? (
        <AuditLogsView auditLogs={auditLogs} currentUser={currentUser} />
      ) : activeTab === 'system' ? (
        <SystemView
          currentUser={currentUser}
          departments={departments}
          apiKeys={apiKeys}
          webhooks={webhooks}
          onCreateApiKey={handleCreateApiKey}
          onDeleteApiKey={handleDeleteApiKey}
          onCreateWebhook={handleCreateWebhook}
          onRevokeApiKey={handleRevokeApiKey}
          dbStatus={dbStatus}
        />
      ) : (
        <IntegrationsView currentUser={currentUser} onSetupCompleted={() => setInitialSetupMode(false)} />
      );
    content = <div className="nps-base-screen">{base}</div>;
  }

  return (
    <NpsShell
      currentUser={currentUser}
      activeTab={activeTab}
      onSelect={go}
      onLogout={handleLogout}
      notifications={notifications}
      onNotificationClick={() => setIsUpdateDialogOpen(true)}
      offline={connectionStatus === 'offline'}
      setupBanner={
        initialSetupMode && currentUser.role === 'DEVELOPER' ? (
          <div className="bg-[var(--nps-yellow)] text-[#1d1d1b] px-4 py-2.5 text-[13px] font-semibold flex items-center justify-between gap-3">
            <span>Configuração inicial pendente: configure o e-mail em Integração para ativar a verificação em duas etapas.</span>
            <button type="button" className="nps-btn nps-btn-sm bg-[#1d1d1b] text-[#f6d35c]" onClick={() => navigate('/integracao')}>
              Configurar
            </button>
          </div>
        ) : null
      }
    >
      {isLocked && (
        <LockScreen
          currentUser={currentUser}
          hasPin={securityPolicy.hasPin || Boolean(currentUser.hasPin)}
          onUnlocked={handleUnlocked}
          onForcedLogout={(msg) => {
            setIsLocked(false);
            dispatchSessionExpired(msg);
          }}
          onLogout={handleLogout}
        />
      )}

      <PageHeader
        eyebrow={isSettings ? 'Configurações' : 'NPS Franqueados'}
        title={activeTab === 'dashboard' ? 'Dashboard Geral' : TAB_TITLE[activeTab]}
        subtitle={SUBTITLES[activeTab]}
        right={['dashboard', 'indicators', 'units'].includes(activeTab) ? periodSelect : undefined}
      />
      {npsError && summary && !isSettings && (
        <div className="mb-4 flex items-center gap-2 text-[13px] text-[var(--nps-red)]">
          <AlertCircle className="w-4 h-4" /> {npsError}
        </div>
      )}
      {content}

      {openResponse && <ResponseDetailModal inviteId={openResponse} onClose={() => setOpenResponse(null)} onSaved={loadNps} toast={setToast} />}
      <Toast message={toast} onDone={() => setToast(null)} />
      <AccessDeniedModal
        isOpen={accessDenied.isOpen}
        onClose={() => setAccessDenied({ isOpen: false, reason: '', resourceName: '' })}
        reason={accessDenied.reason}
        resourceName={accessDenied.resourceName}
        requiredRoleOrPermission="Perfil Desenvolvedor"
      />
      {newVersionReady && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-5 z-[70] w-[calc(100%-1.5rem)] max-w-md">
          <div className="bg-[#1d1d1b] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-[#30302d]">
            <RefreshCw className="w-5 h-5 text-[#f6d35c] shrink-0" />
            <div className="flex-1 text-[13px]">
              <div className="font-semibold">O NPS foi atualizado</div>
              <div className="text-white/70">Recarregue para usar a versão nova.</div>
            </div>
            <button type="button" className="nps-btn nps-btn-primary nps-btn-sm" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      )}
      {isUpdateDialogOpen && updateNotice?.updateAvailable && (
        <UpdateNoticeDialog
          notice={updateNotice}
          canApply={currentUser.role === 'DEVELOPER'}
          onClose={() => setIsUpdateDialogOpen(false)}
          onApply={() => {
            setIsUpdateDialogOpen(false);
            navigate('/integracao');
            window.setTimeout(() => document.getElementById('atualizacao-sistema')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
          }}
        />
      )}
    </NpsShell>
  );
}
