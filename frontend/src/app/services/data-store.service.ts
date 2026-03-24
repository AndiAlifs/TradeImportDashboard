import { Injectable, signal } from '@angular/core';

export interface SlaConfig {
  slaMinMinutes: number;
  slaMaxMinutes: number;
}

const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';
const ASSIGNEE_KEY = 'shila_assignee_master';
const OFFICER_KEY = 'shila_officer_master';
const MOCK_ROLE_KEY = 'shila_mock_role';

const DEFAULT_SLA: SlaConfig = { slaMinMinutes: 90, slaMaxMinutes: 120 };

export type MockRole =
  | 'super_admin'
  | 'executive'
  | 'import_officer'
  | 'import_staff'
  | 'export_officer'
  | 'export_staff';

export interface RoleOption {
  value: MockRole;
  label: string;
  scope: 'All' | 'Import' | 'Export';
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'super_admin', label: 'Super Admin', scope: 'All' },
  { value: 'executive', label: 'Executive', scope: 'All' },
  { value: 'import_officer', label: 'Import Officer', scope: 'Import' },
  { value: 'import_staff', label: 'Import Staff', scope: 'Import' },
  { value: 'export_officer', label: 'Export Officer', scope: 'Export' },
  { value: 'export_staff', label: 'Export Staff', scope: 'Export' },
];

function parseStoredRole(raw: string | null): MockRole {
  if (ROLE_OPTIONS.some((r) => r.value === raw)) {
    return raw as MockRole;
  }
  return 'super_admin';
}

@Injectable({
  providedIn: 'root'
})
export class DataStoreService {
  private apiBase = (window as any).SHILA_API_BASE || 'http://localhost:8081/api';
  readonly roleOptions = ROLE_OPTIONS;

  lcs = signal<any[]>([]);
  slaConfig = signal<SlaConfig>({ ...DEFAULT_SLA });
  events = signal<any[]>([]);
  assignees = signal<any[]>([]);
  officers = signal<any[]>([]);
  isBackendOnline = signal<boolean>(false);
  currentRole = signal<MockRole>(parseStoredRole(localStorage.getItem(MOCK_ROLE_KEY)));

  constructor() {
    this.loadLocalFallback();
  }

  get currentRoleOption(): RoleOption {
    return ROLE_OPTIONS.find((role) => role.value === this.currentRole()) || ROLE_OPTIONS[0];
  }

  get currentScope(): 'All' | 'Import' | 'Export' {
    return this.currentRoleOption.scope;
  }

  setMockRole(role: MockRole): void {
    this.currentRole.set(role);
    localStorage.setItem(MOCK_ROLE_KEY, role);
  }

  getRoleLabel(role: MockRole = this.currentRole()): string {
    return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  }

  defaultRouteForRole(role: MockRole = this.currentRole()): string {
    switch (role) {
      case 'import_officer':
      case 'import_staff':
        return '/import';
      case 'export_officer':
      case 'export_staff':
        return '/export';
      default:
        return '/';
    }
  }

  canAccessTransaction(transactionType?: string): boolean {
    if (!transactionType) return true;
    if (this.currentScope === 'All') return true;
    return this.currentScope.toLowerCase() === transactionType.toLowerCase();
  }

  canAccessMenu(menu: 'exec' | 'import' | 'export' | 'assignee-master' | 'officer-master' | 'sla' | 'eventlog'): boolean {
    const role = this.currentRole();
    if (role === 'super_admin') return true;
    if (role === 'executive') {
      return menu === 'exec' || menu === 'assignee-master' || menu === 'officer-master' || menu === 'sla' || menu === 'eventlog';
    }

    if (menu === 'exec') return true;
    if (menu === 'import') return role === 'import_officer' || role === 'import_staff';
    if (menu === 'export') return role === 'export_officer' || role === 'export_staff';
    if (menu === 'assignee-master') return role === 'import_officer' || role === 'export_officer';
    if (menu === 'officer-master' || menu === 'sla' || menu === 'eventlog') return false;
    return false;
  }

  canAccessPath(path: string): boolean {
    const normalizedPath = path.split('?')[0];
    const role = this.currentRole();
    if (role === 'super_admin') return true;

    if (role === 'executive') {
      return normalizedPath === '/' || normalizedPath === '/assignee-master' || normalizedPath === '/officer-registration' || normalizedPath === '/sla' || normalizedPath === '/eventlog';
    }

    if (normalizedPath === '/' || normalizedPath.startsWith('/import') || normalizedPath.startsWith('/export')) {
      if (normalizedPath.startsWith('/import')) return this.canAccessTransaction('Import');
      if (normalizedPath.startsWith('/export')) return this.canAccessTransaction('Export');
      return true;
    }

    if (normalizedPath === '/assignee-master') {
      return role === 'import_officer' || role === 'export_officer';
    }
    if (normalizedPath === '/officer-registration' || normalizedPath === '/sla' || normalizedPath === '/eventlog') {
      return false;
    }
    return false;
  }

  canAccessAction(
    action:
      | 'create_lc'
      | 'update_status'
      | 'release_lc'
      | 'manage_assignee'
      | 'manage_officer'
      | 'manage_sla'
      | 'reset_data',
    transactionType?: string
  ): boolean {
    const role = this.currentRole();
    if (role === 'super_admin') return true;
    if (role === 'executive') {
      return action === 'manage_assignee' || action === 'manage_officer' || action === 'manage_sla' || action === 'reset_data';
    }

    if (transactionType && !this.canAccessTransaction(transactionType)) {
      return false;
    }

    switch (action) {
      case 'create_lc':
      case 'update_status':
        return role === 'import_officer' || role === 'import_staff' || role === 'export_officer' || role === 'export_staff';
      case 'release_lc':
        return role === 'import_officer' || role === 'export_officer';
      case 'manage_assignee':
        return role === 'import_officer' || role === 'export_officer';
      case 'manage_officer':
      case 'manage_sla':
      case 'reset_data':
        return false;
      default:
        return false;
    }
  }

  private buildMockHeaders(existing: HeadersInit | undefined): HeadersInit {
    return {
      'X-Mock-Role': this.currentRole(),
      'X-Mock-Scope': this.currentScope,
      'X-Mock-User': this.getRoleLabel(),
      ...(existing || {}),
    };
  }

  private async apiRequest(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.apiBase}${path}`, {
      headers: { 'Content-Type': 'application/json', ...this.buildMockHeaders(options.headers) },
      ...options,
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const err = await response.json();
        if (err && err.error) {
          message = err.error;
        }
      } catch (_ignored) { }
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  private loadLocalFallback(): void {
    try { this.lcs.set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { this.lcs.set([]); }
    try { this.slaConfig.set(JSON.parse(localStorage.getItem(SLA_KEY) || JSON.stringify(DEFAULT_SLA))); } catch { this.slaConfig.set({ ...DEFAULT_SLA }); }
    try { this.events.set(JSON.parse(localStorage.getItem(EVENT_LOG_KEY) || '[]')); } catch { this.events.set([]); }
    try { this.assignees.set(JSON.parse(localStorage.getItem(ASSIGNEE_KEY) || '[]')); } catch { this.assignees.set([]); }
    try { this.officers.set(JSON.parse(localStorage.getItem(OFFICER_KEY) || '[]')); } catch { this.officers.set([]); }
  }

  private persistLocalCache(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lcs()));
    localStorage.setItem(SLA_KEY, JSON.stringify(this.slaConfig()));
    localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.events()));
    localStorage.setItem(ASSIGNEE_KEY, JSON.stringify(this.assignees()));
    localStorage.setItem(OFFICER_KEY, JSON.stringify(this.officers()));
  }

  async refreshData(): Promise<void> {
    try {
      const [lcResp, slaResp, eventResp, assigneeResp, officerResp] = await Promise.allSettled([
        this.apiRequest('/lc?limit=500&offset=0'),
        this.apiRequest('/sla'),
        this.apiRequest('/events?limit=500&offset=0'),
        this.apiRequest('/assignees'),
        this.apiRequest('/officers'),
      ]);

      const anySuccess = [lcResp, slaResp, eventResp, assigneeResp, officerResp].some((r) => r.status === 'fulfilled');
      this.isBackendOnline.set(anySuccess);

      if (lcResp.status === 'fulfilled') this.lcs.set(Array.isArray(lcResp.value?.data) ? lcResp.value.data : []);
      if (slaResp.status === 'fulfilled') this.slaConfig.set(slaResp.value || { ...DEFAULT_SLA });
      if (eventResp.status === 'fulfilled') this.events.set(Array.isArray(eventResp.value?.data) ? eventResp.value.data : []);
      else this.events.set([]);
      if (assigneeResp.status === 'fulfilled') this.assignees.set(Array.isArray(assigneeResp.value?.data) ? assigneeResp.value.data : []);
      else this.assignees.set([]);
      if (officerResp.status === 'fulfilled') this.officers.set(Array.isArray(officerResp.value?.data) ? officerResp.value.data : []);
      else this.officers.set([]);

      this.persistLocalCache();
    } catch (e) {
      console.warn("Backend might be offline. Using local cache.");
      this.isBackendOnline.set(false);
    }
  }

  async createLCOrder(data: any): Promise<void> {
    await this.apiRequest('/lc', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async updateLCStatus(id: number, data: any): Promise<void> {
    await this.apiRequest(`/lc/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async saveSlaConfig(config: SlaConfig): Promise<void> {
    await this.apiRequest('/sla', { method: 'PATCH', body: JSON.stringify(config) });
    await this.refreshData();
  }

  async createAssignee(data: { name: string }): Promise<void> {
    await this.apiRequest('/assignees', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async createOfficer(data: { name: string }): Promise<void> {
    await this.apiRequest('/officers', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async updateAssignee(id: number, data: { name?: string, isActive?: boolean }): Promise<void> {
    await this.apiRequest(`/assignees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async deleteAssignee(id: number): Promise<void> {
    await this.apiRequest(`/assignees/${id}`, { method: 'DELETE' });
    await this.refreshData();
  }

  async updateOfficer(id: number, data: { name?: string, isActive?: boolean }): Promise<void> {
    await this.apiRequest(`/officers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async deleteOfficer(id: number): Promise<void> {
    await this.apiRequest(`/officers/${id}`, { method: 'DELETE' });
    await this.refreshData();
  }

  async resetAllData(): Promise<void> {
    await this.apiRequest('/reset', { method: 'POST' });
    await this.refreshData();
  }
}