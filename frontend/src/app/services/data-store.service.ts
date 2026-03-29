import { Injectable, signal } from '@angular/core';

export interface SlaConfig {
  slaMaxMinutes: number;
}

export interface CreateLCOrderRequest {
  transactionType: string;
  urn: string;
  subject: string;
  assignedTo: string;
  receivedAt: string;
}

export interface UpdateLCRequest {
  urn: string;
  subject: string;
  transactionType: string;
  assignedTo: string;
  receivedAt: string;
}

interface LCUpdateStreamEvent {
  lcId: number;
  urn: string;
  transactionType: string;
  fromStatus: string;
  toStatus: string;
  updatedBy: string;
  occurredAt: string;
}

const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';
const ASSIGNEE_KEY = 'shila_assignee_master';
const OFFICER_KEY = 'shila_officer_master';
const MOCK_ROLE_KEY = 'shila_mock_role';
const EXEC_DASHBOARD_RANGE_KEY = 'shila_exec_date_range';
const OPS_DASHBOARD_RANGE_KEY = 'shila_ops_date_range';

const DEFAULT_SLA: SlaConfig = { slaMaxMinutes: 120 };

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

export type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month' | 'custom';
export type DashboardContext = 'executive' | 'operations';

export interface DashboardDateRange {
  preset: DateRangePreset;
  fromDate: string;
  toDate: string;
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
  private stream: EventSource | null = null;
  private reconnectTimer: number | null = null;
  private refreshTimer: number | null = null;
  private realtimeStopped = true;
  readonly roleOptions = ROLE_OPTIONS;

  lcs = signal<any[]>([]);
  slaConfig = signal<SlaConfig>({ ...DEFAULT_SLA });
  events = signal<any[]>([]);
  assignees = signal<any[]>([]);
  officers = signal<any[]>([]);
  isBackendOnline = signal<boolean>(false);
  currentRole = signal<MockRole>(parseStoredRole(localStorage.getItem(MOCK_ROLE_KEY)));
  executiveDateRange = signal<DashboardDateRange>(this.loadDashboardDateRange(EXEC_DASHBOARD_RANGE_KEY));
  operationsDateRange = signal<DashboardDateRange>(this.loadDashboardDateRange(OPS_DASHBOARD_RANGE_KEY));
  activeDashboardContext = signal<DashboardContext>('executive');

  constructor() {
    this.loadLocalFallback();
  }

  startRealtimeSync(): void {
    this.realtimeStopped = false;
    this.connectRealtimeStream();
  }

  stopRealtimeSync(): void {
    this.realtimeStopped = true;
    this.clearReconnectTimer();
    this.clearRefreshTimer();
    this.closeRealtimeStream();
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

  setActiveDashboardContext(context: DashboardContext): void {
    this.activeDashboardContext.set(context);
  }

  getDateRange(context: DashboardContext): DashboardDateRange {
    return context === 'executive' ? this.executiveDateRange() : this.operationsDateRange();
  }

  async setPresetDateRange(context: DashboardContext, preset: Exclude<DateRangePreset, 'custom'>, autoRefresh = true): Promise<void> {
    const nextRange: DashboardDateRange = { preset, fromDate: '', toDate: '' };
    this.storeDateRange(context, nextRange);
    if (autoRefresh && this.activeDashboardContext() === context) {
      await this.refreshData();
    }
  }

  async setCustomDateRange(context: DashboardContext, fromDate: string, toDate: string, autoRefresh = true): Promise<void> {
    const nextRange: DashboardDateRange = { preset: 'custom', fromDate, toDate };
    this.storeDateRange(context, nextRange);
    if (autoRefresh && this.activeDashboardContext() === context) {
      await this.refreshData();
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
      return menu === 'exec' || menu === 'eventlog';
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
      return normalizedPath === '/' || normalizedPath === '/eventlog';
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
      | 'update_lc'
      | 'delete_lc'
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
      case 'update_lc':
        return role === 'import_officer' || role === 'import_staff' || role === 'export_officer' || role === 'export_staff';
      case 'delete_lc':
        return false;
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

  private connectRealtimeStream(): void {
    if (this.realtimeStopped || this.stream) {
      return;
    }

    const streamUrl = `${this.apiBase}/events/stream`;
    const stream = new EventSource(streamUrl);

    stream.addEventListener('lc_update', (rawEvent) => {
      const event = rawEvent as MessageEvent<string>;
      this.onRealtimeUpdate(event.data);
    });

    stream.onerror = () => {
      this.closeRealtimeStream();
      this.scheduleReconnect();
    };

    this.stream = stream;
  }

  private closeRealtimeStream(): void {
    if (!this.stream) return;
    this.stream.close();
    this.stream = null;
  }

  private scheduleReconnect(): void {
    if (this.realtimeStopped || this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectRealtimeStream();
    }, 3000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer === null) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private onRealtimeUpdate(rawData: string): void {
    let payload: LCUpdateStreamEvent;
    try {
      payload = JSON.parse(rawData) as LCUpdateStreamEvent;
    } catch {
      return;
    }

    if (!this.canAccessTransaction(payload.transactionType)) {
      return;
    }

    this.scheduleSilentRefresh();
  }

  private scheduleSilentRefresh(): void {
    if (this.refreshTimer !== null) {
      return;
    }

    this.refreshTimer = window.setTimeout(async () => {
      this.refreshTimer = null;
      await this.refreshData();
    }, 500);
  }

  private loadLocalFallback(): void {
    try { this.lcs.set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { this.lcs.set([]); }
    try { this.slaConfig.set(JSON.parse(localStorage.getItem(SLA_KEY) || JSON.stringify(DEFAULT_SLA))); } catch { this.slaConfig.set({ ...DEFAULT_SLA }); }
    try { this.events.set(JSON.parse(localStorage.getItem(EVENT_LOG_KEY) || '[]')); } catch { this.events.set([]); }
    try { this.assignees.set(JSON.parse(localStorage.getItem(ASSIGNEE_KEY) || '[]')); } catch { this.assignees.set([]); }
    try { this.officers.set(JSON.parse(localStorage.getItem(OFFICER_KEY) || '[]')); } catch { this.officers.set([]); }
  }

  private loadDashboardDateRange(storageKey: string): DashboardDateRange {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || 'null') as Partial<DashboardDateRange> | null;
      if (!raw || !raw.preset) {
        return { preset: 'today', fromDate: '', toDate: '' };
      }
      if (raw.preset === 'custom' && raw.fromDate && raw.toDate) {
        return { preset: 'custom', fromDate: raw.fromDate, toDate: raw.toDate };
      }
      if (
        raw.preset === 'today'
        || raw.preset === 'yesterday'
        || raw.preset === 'last7days'
        || raw.preset === 'last14days'
        || raw.preset === 'last1month'
      ) {
        return { preset: raw.preset, fromDate: '', toDate: '' };
      }
    } catch {
      // fall through to default
    }
    return { preset: 'today', fromDate: '', toDate: '' };
  }

  private storeDateRange(context: DashboardContext, nextRange: DashboardDateRange): void {
    if (context === 'executive') {
      this.executiveDateRange.set(nextRange);
      localStorage.setItem(EXEC_DASHBOARD_RANGE_KEY, JSON.stringify(nextRange));
      return;
    }
    this.operationsDateRange.set(nextRange);
    localStorage.setItem(OPS_DASHBOARD_RANGE_KEY, JSON.stringify(nextRange));
  }

  private buildDateQuery(context: DashboardContext): string {
    const range = this.getDateRange(context);
    return this.buildDateQueryFromRange(range);
  }

  private buildDateQueryFromRange(range: DashboardDateRange): string {
    const params = new URLSearchParams();

    if (range.preset === 'custom') {
      params.set('fromDate', range.fromDate);
      params.set('toDate', range.toDate);
      return params.toString();
    }

    params.set('preset', range.preset);
    return params.toString();
  }

  private toDateInputValue(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readLocalLcCache(): any[] {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  getPreviousEquivalentRange(range: DashboardDateRange): DashboardDateRange {
    const bounds = this.getRangeBounds(range);
    if (!bounds) {
      return { preset: 'yesterday', fromDate: '', toDate: '' };
    }

    const windowMs = bounds.to.getTime() - bounds.from.getTime();
    const prevTo = new Date(bounds.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - windowMs);

    return {
      preset: 'custom',
      fromDate: this.toDateInputValue(prevFrom),
      toDate: this.toDateInputValue(prevTo),
    };
  }

  async fetchLCsForRange(range: DashboardDateRange, options: { transactionType?: 'Import' | 'Export' } = {}): Promise<any[]> {
    const params = new URLSearchParams('limit=500&offset=0');
    const dateQuery = this.buildDateQueryFromRange(range);

    if (options.transactionType) {
      params.set('transactionType', options.transactionType);
    }

    if (dateQuery) {
      const parsed = new URLSearchParams(dateQuery);
      parsed.forEach((value, key) => {
        params.set(key, value);
      });
    }

    try {
      const response = await this.apiRequest(`/lc?${params.toString()}`);
      return Array.isArray(response?.data) ? response.data : [];
    } catch {
      const cached = this.readLocalLcCache();
      return cached.filter((record) => this.isWithinRange(record?.receivedAt, range));
    }
  }

  async fetchAllEvents(): Promise<any[]> {
    const pageSize = 500;
    let offset = 0;
    let total = 0;
    const combined: any[] = [];

    try {
      do {
        const response = await this.apiRequest(`/events?limit=${pageSize}&offset=${offset}`);
        const chunk = Array.isArray(response?.data) ? response.data : [];
        total = Number(response?.total || 0);

        combined.push(...chunk);
        offset += chunk.length;

        if (chunk.length === 0) {
          break;
        }
      } while (offset < total);

      this.events.set(combined);
      this.persistLocalCache();
      return combined;
    } catch {
      return this.events();
    }
  }

  private getRangeBounds(range: DashboardDateRange): { from: Date; to: Date } | null {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (range.preset === 'today') {
      const end = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { from: startOfToday, to: end };
    }
    if (range.preset === 'yesterday') {
      const from = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(startOfToday.getTime() - 1);
      return { from, to };
    }
    if (range.preset === 'last7days') {
      const from = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const to = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { from, to };
    }
    if (range.preset === 'last14days') {
      const from = new Date(startOfToday.getTime() - 13 * 24 * 60 * 60 * 1000);
      const to = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { from, to };
    }
    if (range.preset === 'last1month') {
      const from = new Date(startOfToday);
      from.setMonth(from.getMonth() - 1);
      from.setDate(from.getDate() + 1);
      const to = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { from, to };
    }

    if (!range.fromDate || !range.toDate) {
      return null;
    }
    const from = new Date(`${range.fromDate}T00:00:00`);
    const to = new Date(`${range.toDate}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) {
      return null;
    }
    return { from, to };
  }

  private isWithinRange(iso: string | undefined, range: DashboardDateRange): boolean {
    if (!iso) return false;
    const bounds = this.getRangeBounds(range);
    if (!bounds) return true;
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= bounds.from.getTime() && ts <= bounds.to.getTime();
  }

  private applyRangeFilterToCache(context: DashboardContext): void {
    const range = this.getDateRange(context);
    this.lcs.set(this.lcs().filter((record) => this.isWithinRange(record?.receivedAt, range)));
    this.events.set(this.events().filter((event) => this.isWithinRange(event?.timestamp, range)));
  }

  private persistLocalCache(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lcs()));
    localStorage.setItem(SLA_KEY, JSON.stringify(this.slaConfig()));
    localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.events()));
    localStorage.setItem(ASSIGNEE_KEY, JSON.stringify(this.assignees()));
    localStorage.setItem(OFFICER_KEY, JSON.stringify(this.officers()));
  }

  async refreshData(options: { transactionType?: 'Import' | 'Export' } = {}): Promise<void> {
    try {
      const context = this.activeDashboardContext();
      const dateQuery = this.buildDateQuery(context);
      const lcParams = new URLSearchParams('limit=500&offset=0');
      const eventParams = new URLSearchParams('limit=500&offset=0');

      if (options.transactionType) {
        lcParams.set('transactionType', options.transactionType);
      }
      if (dateQuery) {
        const parsed = new URLSearchParams(dateQuery);
        parsed.forEach((value, key) => {
          lcParams.set(key, value);
          eventParams.set(key, value);
        });
      }

      const [lcResp, slaResp, eventResp, assigneeResp, officerResp] = await Promise.allSettled([
        this.apiRequest(`/lc?${lcParams.toString()}`),
        this.apiRequest('/sla'),
        this.apiRequest(`/events?${eventParams.toString()}`),
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
      this.applyRangeFilterToCache(this.activeDashboardContext());
    }
  }

  async createLCOrder(data: CreateLCOrderRequest): Promise<void> {
    await this.apiRequest('/lc', { method: 'POST', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async updateLCStatus(id: number, data: any): Promise<void> {
    try {
      await this.apiRequest(`/lc/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) });
      await this.refreshData();
    } catch (error) {
      await this.refreshData();
      throw error;
    }
  }

  async updateLC(id: number, data: UpdateLCRequest): Promise<void> {
    await this.apiRequest(`/lc/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await this.refreshData();
  }

  async deleteLC(id: number): Promise<void> {
    await this.apiRequest(`/lc/${id}`, { method: 'DELETE' });
    await this.refreshData();
  }

  async getLCExceptions(id: number): Promise<any[]> {
    try {
      const resp = await this.apiRequest(`/lc/${id}/exceptions`);
      return Array.isArray(resp) ? resp : [];
    } catch {
      return [];
    }
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