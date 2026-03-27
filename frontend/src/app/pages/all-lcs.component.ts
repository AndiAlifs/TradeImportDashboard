import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { StageDuration, computeLcStageDurations, findLongestStage, formatMinutesLabel } from '../utils/stage-duration';

@Component({
  selector: 'app-all-lcs',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page-content">
      <div class="date-range-toolbar">
        <div class="date-range-presets">
          <button
            type="button"
            class="range-pill"
            *ngFor="let preset of presets"
            [class.active]="isPresetActive(preset.value)"
            (click)="usePreset(preset.value)">
            {{ preset.labelKey | translate }}
          </button>
        </div>
        <div class="date-range-custom">
          <input type="date" [value]="customFrom" (change)="customFrom = $any($event.target).value" />
          <span>{{ 'date.to' | translate }}</span>
          <input type="date" [value]="customTo" (change)="customTo = $any($event.target).value" />
          <button type="button" class="range-apply-btn" (click)="applyCustomRange()">{{ 'date.apply' | translate }}</button>
        </div>
        <div class="date-range-caption">{{ 'date.server_time' | translate }} · {{ selectedRangeLabel() }}</div>
      </div>

      <div class="data-table-wrapper">
        <div class="table-header">
          <h3>
            {{ 'page.all_lcs.title' | translate }} ({{ transactionType() }})
            <span class="range-state-badge">{{ selectedRangeLabel() }}</span>
          </h3>
          <div class="table-filters">
            <input type="text" class="search-input" [placeholder]="'queue.search' | translate"
              [(ngModel)]="searchTerm" (input)="onSearch()" />
            <button class="filter-btn" *ngFor="let f of filters"
              [class.active]="currentFilter() === f.value"
              (click)="setFilter(f.value)">{{ f.label }}</button>
          </div>
        </div>
        <div class="table-scroll" style="max-height: calc(100vh - 250px);">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'queue.col_num' | translate }}</th>
                <th>{{ 'queue.col_urn' | translate }}</th>
                <th>{{ 'summary.col_type' | translate }}</th>
                <th>{{ 'queue.col_sender' | translate }}</th>
                <th>{{ 'queue.col_subject' | translate }}</th>
                <th>{{ 'queue.col_assigned' | translate }}</th>
                <th>{{ 'queue.col_status' | translate }}</th>
                <th>{{ 'queue.col_received' | translate }}</th>
                <th>{{ 'queue.col_elapsed' | translate }}</th>
                <th>{{ 'queue.col_sla' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredRecords().length === 0">
                <td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'queue.no_records' | translate }}</td>
              </tr>
              <tr *ngFor="let r of filteredRecords(); let i = index">
                <td style="color:var(--text-muted)">{{ i + 1 }}</td>
                <td><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                <td><span class="type-badge" [ngClass]="r.transactionType === 'Import' ? 'import' : 'export'">{{ r.transactionType }}</span></td>
                <td style="font-size:0.8rem">{{ r.senderEmail }}</td>
                <td style="font-size:0.8rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.subject">{{ r.subject }}</td>
                <td style="font-size:0.8rem">{{ r.assignedTo }}</td>
                <td><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">{{ formatTime(r.receivedAt) }}</td>
                <td class="elapsed-time">{{ formatElapsed(r) }}</td>
                <td [innerHTML]="slaIndicatorHtml(r)"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>{{ 'queue.showing' | translate }} {{ filteredRecords().length }} {{ 'queue.of' | translate }} {{ totalRecords() }} {{ 'queue.records' | translate }}</span>
        </div>
      </div>

      <!-- LC Detail Modal -->
      <div class="modal-overlay" [class.active]="!!selectedLc" (click)="selectedLc = null">
        <div class="modal-container" *ngIf="selectedLc" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ selectedLc.urn }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ selectedLc.transactionType }}] {{ selectedLc.subject }}</div>
            </div>
            <button class="modal-close" (click)="selectedLc = null">×</button>
          </div>
          <div class="modal-body">
            <div class="timeline">
              <div *ngIf="selectedLc.receivedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.received' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.receivedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.received' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.draftingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Drafting' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.drafting' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.draftingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.drafting' | translate }}{{ selectedLc.assignedTo ? ' by ' + selectedLc.assignedTo : '' }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.checkingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Checking Underlying' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.checking' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.checkingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.checking' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.exceptionStartedAt || selectedLc.exceptionTotalMinutes > 0" class="timeline-item" [ngClass]="selectedLc.status === 'Exception' ? 'exception active' : 'exception completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.exception' | translate }}</div>
                  <div class="timeline-time">{{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</div>
                  <div class="timeline-desc">{{ selectedLc.status === 'Exception' ? (selectedLc.exceptionReason || ('timeline.desc.exception_active' | translate)) : ('timeline.desc.exception_resolved' | translate) }}{{ selectedLc.status !== 'Exception' && selectedLc.exceptionTotalMinutes ? ' (' + selectedLc.exceptionTotalMinutes + ' min total)' : '' }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.releasedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.released' | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.releasedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.released' | translate }}</div>
                </div>
              </div>
            </div>

            <div class="stage-duration-card" *ngIf="selectedLc">
              <div class="stage-duration-header">
                <h4>{{ 'timeline.stage_duration' | translate }}</h4>
                <span *ngIf="getLcBottleneck(selectedLc) as bottleneck" class="stage-duration-pill">
                  {{ 'timeline.longest_stage' | translate }}: {{ bottleneck.labelKey | translate }} ({{ formatMinutesLabel(bottleneck.minutes) }})
                </span>
              </div>

              <div *ngIf="getLcStageDurations(selectedLc).length === 0" class="stage-duration-empty">
                {{ 'timeline.no_stage_duration' | translate }}
              </div>

              <div class="stage-share-wrap" *ngIf="getLcStageDurations(selectedLc).length > 0">
                <div class="stage-share-title">{{ 'timeline.stage_share' | translate }}</div>
                <div class="stage-share-bar">
                  <div
                    *ngFor="let segment of getStageShareSegments(selectedLc)"
                    class="stage-share-segment"
                    [ngClass]="segment.className"
                    [style.width.%]="segment.percent"
                    [title]="(segment.labelKey | translate) + ' ' + formatPercent(segment.percent) + ' (' + formatMinutesLabel(segment.minutes) + ')'">
                  </div>
                </div>
                <div class="stage-share-legend">
                  <span class="stage-share-item" *ngFor="let segment of getStageShareSegments(selectedLc)">
                    <span class="stage-share-dot" [ngClass]="segment.className"></span>
                    <span>{{ segment.labelKey | translate }}</span>
                    <strong>{{ formatPercent(segment.percent) }}</strong>
                  </span>
                </div>
              </div>

              <div class="stage-duration-list" *ngIf="getLcStageDurations(selectedLc).length > 0">
                <div class="stage-duration-row" *ngFor="let stage of getLcStageDurations(selectedLc)">
                  <div class="stage-duration-label">
                    {{ stage.labelKey | translate }}
                    <span *ngIf="stage.isActive" class="stage-live-tag">{{ 'timeline.live' | translate }}</span>
                  </div>
                  <div class="stage-duration-track">
                    <div class="stage-duration-fill" [class.longest]="stage.isLongest" [style.width.%]="stageWidth(stage.minutes, selectedLc)"></div>
                  </div>
                  <div class="stage-duration-value">{{ formatMinutesLabel(stage.minutes) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class AllLcsComponent implements OnInit {
  dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);
  private route = inject(ActivatedRoute);

  searchTerm = '';
  currentFilter = signal('all');
  selectedLc: any = null;
  transactionType = signal<string>('Import');
  customFrom = '';
  customTo = '';
  range = computed(() => this.dataStore.operationsDateRange());

  readonly presets: Array<{ value: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'; labelKey: string }> = [
    { value: 'today', labelKey: 'date.today' },
    { value: 'yesterday', labelKey: 'date.yesterday' },
    { value: 'last7days', labelKey: 'date.last_7_days' },
    { value: 'last14days', labelKey: 'date.last_14_days' },
    { value: 'last1month', labelKey: 'date.last_month' },
  ];

  filters = [
    { label: 'All', value: 'all' },
    { label: 'Received', value: 'Received' },
    { label: 'Drafting', value: 'Drafting' },
    { label: 'Checking', value: 'Checking Underlying' },
    { label: 'Exception', value: 'Exception' },
    { label: 'Released', value: 'Released' },
    { label: 'Breached', value: 'Breached' },
  ];

  private searchSignal = signal('');

  ngOnInit() {
    this.route.data.subscribe(data => {
      if (data['type']) {
        this.transactionType.set(data['type']);
      }
      this.dataStore.setActiveDashboardContext('operations');
      this.syncInputsFromRange();
      void this.dataStore.refreshData({ transactionType: this.transactionType() as 'Import' | 'Export' });
    });
  }

  totalRecords = computed(() => {
    return this.dataStore.lcs().filter(r => r.transactionType === this.transactionType()).length;
  });

  filteredRecords = computed(() => {
    let data = this.dataStore.lcs().filter(r => r.transactionType === this.transactionType());
    const filter = this.currentFilter();
    const search = this.searchSignal().toLowerCase();

    if (filter !== 'all') {
      data = data.filter(r => r.status === filter);
    }
    if (search) {
      data = data.filter(r =>
        (r.urn || '').toLowerCase().includes(search) ||
        (r.senderEmail || '').toLowerCase().includes(search) ||
        (r.subject || '').toLowerCase().includes(search) ||
        (r.assignedTo || '').toLowerCase().includes(search)
      );
    }
    return data;
  });

  setFilter(value: string) {
    this.currentFilter.set(value);
  }

  onSearch() {
    this.searchSignal.set(this.searchTerm);
  }

  usePreset(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): void {
    const bounds = this.presetDateBounds(preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
    void this.dataStore.setPresetDateRange('operations', preset, false)
      .then(() => this.dataStore.refreshData({ transactionType: this.transactionType() as 'Import' | 'Export' }));
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) return;
    void this.dataStore.setCustomDateRange('operations', this.customFrom, this.customTo, false)
      .then(() => this.dataStore.refreshData({ transactionType: this.transactionType() as 'Import' | 'Export' }));
  }

  isPresetActive(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): boolean {
    return this.range().preset === preset;
  }

  selectedRangeLabel(): string {
    const selectedRange = this.range();
    if (selectedRange.preset === 'custom') {
      if (!selectedRange.fromDate || !selectedRange.toDate) {
        return this.ts.translate('date.custom');
      }
      return `${selectedRange.fromDate} ${this.ts.translate('date.to')} ${selectedRange.toDate}`;
    }
    if (selectedRange.preset === 'yesterday') return this.ts.translate('date.yesterday');
    if (selectedRange.preset === 'last7days') return this.ts.translate('date.last_7_days');
    if (selectedRange.preset === 'last14days') return this.ts.translate('date.last_14_days');
    if (selectedRange.preset === 'last1month') return this.ts.translate('date.last_month');
    return this.ts.translate('date.today');
  }

  showLcDetails(r: any) {
    this.selectedLc = r;
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  statusClass(status: string): string {
    const map: any = { 'Received': 'received', 'Drafting': 'drafting', 'Checking Underlying': 'checking', 'Released': 'released', 'Breached': 'breached', 'Exception': 'exception' };
    return map[status] || 'received';
  }

  slaIndicatorHtml(r: any): string {
    const sla = this.dataStore.slaConfig();
    if (r.status === 'Released' && r.releasedAt) {
      const total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      if (total <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${total}m</span>`;
      if (total <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${total}m</span>`;
      return `<span class="sla-indicator red">✗ ${total}m</span>`;
    }
    const elapsed = this.getElapsedMinutes(r);
    if (elapsed <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${this.ts.translate('sla.ok')}</span>`;
    if (elapsed <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${this.ts.translate('sla.warning')}</span>`;
    return `<span class="sla-indicator red">✗ ${this.ts.translate('sla.breach')}</span>`;
  }

  private getElapsedMinutes(r: any): number {
    let total = 0;
    if (r.status === 'Released' && r.releasedAt) {
      total = Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else if (r.status === 'Exception' && r.exceptionStartedAt) {
      total = Math.round((new Date(r.exceptionStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
    } else {
      total = Math.round((Date.now() - new Date(r.receivedAt).getTime()) / 60000);
    }
    return Math.max(0, total - (r.exceptionTotalMinutes || 0));
  }

  getLcStageDurations(r: any): StageDuration[] {
    return computeLcStageDurations(r);
  }

  getLcBottleneck(r: any): StageDuration | null {
    return findLongestStage(this.getLcStageDurations(r));
  }

  stageWidth(minutes: number, r: any): number {
    const stages = this.getLcStageDurations(r);
    const maxMinutes = stages.reduce((max, stage) => Math.max(max, stage.minutes), 0);
    if (maxMinutes <= 0) return 0;
    return Math.max(8, Math.round((minutes / maxMinutes) * 100));
  }

  formatMinutesLabel(minutes: number): string {
    return formatMinutesLabel(minutes);
  }

  getStageShareSegments(r: any): Array<{ labelKey: string; percent: number; className: string; minutes: number }> {
    const stages = this.getLcStageDurations(r);
    const total = stages.reduce((sum, stage) => sum + stage.minutes, 0);
    if (total <= 0) return [];
    return stages.map((stage) => ({
      labelKey: stage.labelKey,
      percent: Math.round((stage.minutes / total) * 1000) / 10,
      className: this.stageShareClass(stage.key),
      minutes: stage.minutes,
    }));
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private stageShareClass(key: StageDuration['key']): string {
    const map: Record<StageDuration['key'], string> = {
      inbox: 'stage-share-inbox',
      drafting: 'stage-share-drafting',
      checking: 'stage-share-checking',
      exception: 'stage-share-exception',
    };
    return map[key];
  }

  private syncInputsFromRange(): void {
    const selectedRange = this.range();
    if (selectedRange.preset === 'custom') {
      this.customFrom = selectedRange.fromDate;
      this.customTo = selectedRange.toDate;
      return;
    }
    const bounds = this.presetDateBounds(selectedRange.preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
  }

  private presetDateBounds(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): { from: string; to: string } {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      const day = this.toDateInputValue(startOfToday);
      return { from: day, to: day };
    }

    if (preset === 'yesterday') {
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      const day = this.toDateInputValue(yesterday);
      return { from: day, to: day };
    }

    if (preset === 'last7days') {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
    }

    if (preset === 'last14days') {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 13);
      return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
    }

    const from = new Date(startOfToday);
    from.setMonth(from.getMonth() - 1);
    from.setDate(from.getDate() + 1);
    return { from: this.toDateInputValue(from), to: this.toDateInputValue(startOfToday) };
  }

  private toDateInputValue(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
