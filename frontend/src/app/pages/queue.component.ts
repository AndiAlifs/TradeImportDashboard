import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { getActionLabel, getTimelineLabel } from '../utils/stage-duration';
import { LcDetailModalComponent } from '../components/lc-detail-modal/lc-detail-modal.component';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LcDetailModalComponent],
  template: `
    <div class="page-content">
      <div class="data-table-wrapper">
        <div class="table-header">
          <h3>{{ 'queue.title' | translate }} ({{ transactionType() }})</h3>
          <div class="table-filters">
            <input type="text" class="search-input" [placeholder]="'queue.search' | translate"
              [(ngModel)]="searchTerm" (input)="onSearch()" />
            <button class="filter-btn" *ngFor="let f of filters"
              [class.active]="currentFilter() === f.value"
              (click)="setFilter(f.value)">{{ f.label }}</button>
          </div>
        </div>
        <div class="table-scroll" style="max-height:600px">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" [class.sorted]="sortColumn() === 'rowNumber'" [attr.aria-sort]="ariaSort('rowNumber')" (click)="toggleSort('rowNumber')">{{ 'queue.col_num' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'rowNumber'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'urn'" [attr.aria-sort]="ariaSort('urn')" (click)="toggleSort('urn')">{{ 'queue.col_urn' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'urn'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'subject'" [attr.aria-sort]="ariaSort('subject')" (click)="toggleSort('subject')">{{ 'queue.col_subject' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'subject'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'assignedTo'" [attr.aria-sort]="ariaSort('assignedTo')" (click)="toggleSort('assignedTo')">{{ 'queue.col_assigned' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'assignedTo'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'status'" [attr.aria-sort]="ariaSort('status')" (click)="toggleSort('status')">{{ 'queue.col_status' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'status'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'startDate'" [attr.aria-sort]="ariaSort('startDate')" (click)="toggleSort('startDate')">{{ 'queue.col_start_date' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'startDate'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'elapsed'" [attr.aria-sort]="ariaSort('elapsed')" (click)="toggleSort('elapsed')">{{ 'queue.col_elapsed' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'elapsed'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'timeLeft'" [attr.aria-sort]="ariaSort('timeLeft')" (click)="toggleSort('timeLeft')">{{ 'queue.col_time_left_sla' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'timeLeft'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'releasedBy'" [attr.aria-sort]="ariaSort('releasedBy')" (click)="toggleSort('releasedBy')">{{ 'queue.col_released_by' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'releasedBy'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
                <th class="sortable" [class.sorted]="sortColumn() === 'action'" [attr.aria-sort]="ariaSort('action')" (click)="toggleSort('action')">{{ 'queue.col_action' | translate }}<span class="sort-indicator" *ngIf="sortColumn() === 'action'">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filteredRecords().length === 0">
                <td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'queue.no_records' | translate }}</td>
              </tr>
              <tr *ngFor="let r of filteredRecords(); let i = index" [class.at-risk-row]="isAtRisk(r)">
                <td style="color:var(--text-muted)">{{ i + 1 }}</td>
                <td><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="r.subject">{{ r.subject }}</td>
                <td style="font-size:0.8rem">{{ r.assignedTo }}</td>
                <td><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">{{ formatStartDate(r.receivedAt) }}</td>
                <td class="elapsed-time">{{ formatElapsed(r) }}</td>
                <td class="elapsed-time" [style.color]="timeLeftColor(r)">{{ formatTimeLeftToSla(r) }}</td>
                <td style="font-size:0.8rem">{{ r.approvedBy || '—' }}</td>
                <td>
                  <ng-container [ngSwitch]="r.status">
                    <ng-container *ngSwitchCase="'Received'">
                      <button class="action-btn primary" [disabled]="!canUpdate()" (click)="handleAction(r, 'start-drafting')">{{ getActionLabel(r.transactionType, 'start_drafting') | translate }}</button>
                      <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" [disabled]="!canUpdate()" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Drafting'">
                      <button class="action-btn warning" [disabled]="!canUpdate()" (click)="handleAction(r, 'start-checking')">{{ getActionLabel(r.transactionType, 'start_checking') | translate }}</button>
                        <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" [disabled]="!canUpdate()" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                        <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary);margin-top:4px" [disabled]="!canUpdate()" (click)="promptReturnStatus(r, 'Received')">{{ 'action.return_to' | translate }} {{ getTimelineLabel(r.transactionType, 'received') | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Checking Underlying'">
                      <div style="display:flex;flex-direction:column;gap:4px">
                        <select class="search-input" style="width:160px;padding:0.35rem 0.5rem;font-size:0.78rem" [(ngModel)]="officerSelections[r.id]" [disabled]="!canRelease()">
                          <option value="" disabled>{{ 'officer_release.select_officer' | translate }}</option>
                          <option *ngFor="let o of officers()" [value]="o.name">{{ o.name }}</option>
                        </select>
                        <button class="action-btn success" [disabled]="!canRelease()" (click)="handleRelease(r)">{{ getActionLabel(r.transactionType, 'release') | translate }}</button>
                          <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary)" [disabled]="!canUpdate()" (click)="promptMarkException(r)">{{ 'action.mark_exception' | translate }}</button>
                          <button class="action-btn" style="background:var(--bg-secondary,#f1f5f9);color:var(--text-secondary)" [disabled]="!canUpdate()" (click)="promptReturnStatus(r, 'Drafting')">{{ 'action.return_to' | translate }} {{ getTimelineLabel(r.transactionType, 'drafting') | translate }}</button>
                      </div>
                    </ng-container>
                    <span *ngSwitchCase="'Released'" class="action-btn completed">{{ 'action.completed' | translate }}</span>
                    <ng-container *ngSwitchCase="'Breached'">
                      <button class="action-btn primary" [disabled]="!canUpdate()" (click)="handleAction(r, 'start-drafting')">{{ 'action.resume' | translate }}</button>
                    </ng-container>
                    <ng-container *ngSwitchCase="'Exception'">
                      <button class="action-btn dark" [disabled]="!canUpdate()" (click)="promptResolveException(r)">{{ 'action.resolve_exception' | translate }}</button>
                    </ng-container>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>{{ 'queue.showing' | translate }} {{ filteredRecords().length }} {{ 'queue.of' | translate }} {{ dataStore.lcs().length }} {{ 'queue.records' | translate }}</span>
        </div>
      </div>

      <app-lc-detail-modal [lc]="selectedLc" [exceptionHistory]="exceptionHistory" (closed)="selectedLc = null"></app-lc-detail-modal>

      <!-- Resolve Exception Modal -->
      <div class="modal-overlay" [class.active]="!!resolvingExceptionLc" (click)="resolvingExceptionLc = null">
        <div class="modal-container form-card" *ngIf="resolvingExceptionLc" (click)="$event.stopPropagation()" style="max-width: 400px;">
          <div class="modal-header">
            <div>
              <h3 style="margin:0;font-size:1rem">{{ 'action.resolve_exception' | translate }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">{{ resolvingExceptionLc.urn }}</div>
            </div>
            <button class="modal-close" (click)="resolvingExceptionLc = null">×</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem">{{ 'queue.col_elapsed' | translate }} (Minutes)</label>
              <input type="number" class="search-input" style="width:100%" [(ngModel)]="resolutionMinutes" min="0" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem">{{ 'action.return_to' | translate }}</label>
              <select class="search-input" style="width:100%" [(ngModel)]="resolutionNextStatus">
                <option value="Drafting">{{ getTimelineLabel(resolvingExceptionLc!.transactionType, 'drafting') | translate }}</option>
                <option value="Checking Underlying">{{ getTimelineLabel(resolvingExceptionLc!.transactionType, 'checking') | translate }}</option>
                <option value="Received">{{ getTimelineLabel(resolvingExceptionLc!.transactionType, 'received') | translate }}</option>
              </select>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:0.5rem">
              <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary)" (click)="resolvingExceptionLc = null">{{ 'action.cancel' | translate }}</button>
              <button class="action-btn success" (click)="submitResolveException()">{{ 'action.submit' | translate }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Mark Exception Modal -->
      <div class="modal-overlay" [class.active]="!!markingExceptionLc" (click)="markingExceptionLc = null">
        <div class="modal-container form-card" *ngIf="markingExceptionLc" (click)="$event.stopPropagation()" style="max-width: 400px;">
          <div class="modal-header">
            <div>
              <h3 style="margin:0;font-size:1rem">{{ 'action.mark_exception' | translate }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">{{ markingExceptionLc.urn }}</div>
            </div>
            <button class="modal-close" (click)="markingExceptionLc = null">×</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem">{{ 'action.reason' | translate }}</label>
              <input type="text" class="search-input" style="width:100%" [(ngModel)]="exceptionNote" [placeholder]="'action.reason' | translate" />
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:0.5rem">
              <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary)" (click)="markingExceptionLc = null">{{ 'action.cancel' | translate }}</button>
              <button class="action-btn danger" (click)="submitMarkException()">{{ 'action.submit' | translate }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Return Status Modal -->
      <div class="modal-overlay" [class.active]="!!returningStatusLc" (click)="returningStatusLc = null">
        <div class="modal-container form-card" *ngIf="returningStatusLc" (click)="$event.stopPropagation()" style="max-width: 400px;">
          <div class="modal-header">
            <div>
              <h3 style="margin:0;font-size:1rem">{{ 'action.return_to' | translate }} {{ returnTargetStatus }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">{{ returningStatusLc.urn }}</div>
            </div>
            <button class="modal-close" (click)="returningStatusLc = null">×</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem">{{ 'action.notes' | translate }}</label>
              <input type="text" class="search-input" style="width:100%" [(ngModel)]="returnNote" [placeholder]="'action.notes' | translate" />
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:0.5rem">
              <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary)" (click)="returningStatusLc = null">{{ 'action.cancel' | translate }}</button>
              <button class="action-btn primary" (click)="submitReturnStatus()">{{ 'action.submit' | translate }}</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class QueueComponent implements OnInit {
  getActionLabel = getActionLabel;
  getTimelineLabel = getTimelineLabel;

  dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);
  private route = inject(ActivatedRoute);

  searchTerm = '';
  currentFilter = signal('all');
  sortColumn = signal<string>('timeLeft');
  sortDirection = signal<'asc' | 'desc'>('asc');
  selectedLc: any = null;
  transactionType = signal<string>('Import');
  officerSelections: Record<number, string> = {};

  resolvingExceptionLc: any = null;
  resolutionMinutes: number = 0;
  resolutionNextStatus: string = '';
  exceptionHistory: any[] = [];

  markingExceptionLc: any = null;
  exceptionNote: string = '';

  returningStatusLc: any = null;
  returnTargetStatus: string = '';
  returnNote: string = '';

  officers = computed(() => this.dataStore.officers().filter(o => o.section === this.transactionType()));
  canUpdate = computed(() => this.dataStore.canAccessAction('update_status', this.transactionType()));
  canRelease = computed(() => this.dataStore.canAccessAction('release_lc', this.transactionType()));

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
    });
  }

  filteredRecords = computed(() => {
    let data = this.dataStore.lcs().filter(r => r.transactionType === this.transactionType());
    const filter = this.currentFilter();
    const search = this.searchSignal().toLowerCase();

    if (filter !== 'all') {
      data = data.filter(r => r.status === filter);
    } else {
      // Exclude Released items when showing "all" (show only uncompleted)
      data = data.filter(r => r.status !== 'Released');
    }
    if (search) {
      data = data.filter(r =>
        (r.urn || '').toLowerCase().includes(search) ||
        (r.subject || '').toLowerCase().includes(search) ||
        (r.assignedTo || '').toLowerCase().includes(search) ||
        (r.approvedBy || '').toLowerCase().includes(search)
      );
    }

    const rowNumberByKey = new Map<string, number>();
    data.forEach((record, index) => rowNumberByKey.set(this.rowKey(record), index + 1));

    return this.sortRows(data, rowNumberByKey);
  });

  toggleSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  ariaSort(column: string): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== column) {
      return 'none';
    }
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  private sortRows(data: any[], rowNumberByKey: Map<string, number>): any[] {
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const sorted = [...data].sort((a, b) => {
      const diff = this.compareByColumn(a, b, rowNumberByKey);
      if (diff !== 0) {
        return diff * direction;
      }
      return this.compareText(a.urn, b.urn);
    });
    return sorted;
  }

  private compareByColumn(a: any, b: any, rowNumberByKey: Map<string, number>): number {
    switch (this.sortColumn()) {
      case 'rowNumber':
        return this.compareNumber(rowNumberByKey.get(this.rowKey(a)) || 0, rowNumberByKey.get(this.rowKey(b)) || 0);
      case 'urn':
        return this.compareText(a.urn, b.urn);
      case 'subject':
        return this.compareText(a.subject, b.subject);
      case 'assignedTo':
        return this.compareText(a.assignedTo, b.assignedTo);
      case 'status':
        return this.compareStatus(a.status, b.status);
      case 'startDate':
        return this.compareNumber(this.toMillis(a.receivedAt), this.toMillis(b.receivedAt));
      case 'elapsed':
        return this.compareNumber(this.getElapsedMinutes(a), this.getElapsedMinutes(b));
      case 'timeLeft':
        return this.compareNumber(this.getRemainingSlaMinutes(a), this.getRemainingSlaMinutes(b));
      case 'releasedBy':
        return this.compareText(a.approvedBy, b.approvedBy);
      case 'action':
        return this.compareNumber(this.actionRank(a.status), this.actionRank(b.status));
      default:
        return 0;
    }
  }

  private compareStatus(a: string, b: string): number {
    const rankA = this.statusRank(a);
    const rankB = this.statusRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return this.compareText(a, b);
  }

  private statusRank(status: string): number {
    const rank: Record<string, number> = {
      'Received': 1,
      'Drafting': 2,
      'Checking Underlying': 3,
      'Exception': 4,
      'Released': 5,
      'Breached': 6,
    };
    return rank[status] || 99;
  }

  private actionRank(status: string): number {
    const rank: Record<string, number> = {
      'Received': 1,
      'Drafting': 2,
      'Checking Underlying': 3,
      'Exception': 4,
      'Breached': 5,
      'Released': 6,
    };
    return rank[status] || 99;
  }

  private compareText(a: unknown, b: unknown): number {
    const left = String(a || '').toLowerCase();
    const right = String(b || '').toLowerCase();
    return left.localeCompare(right);
  }

  private compareNumber(a: number, b: number): number {
    return a - b;
  }

  private toMillis(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    return new Date(value).getTime();
  }

  private rowKey(record: any): string {
    if (record?.id !== undefined && record?.id !== null) {
      return String(record.id);
    }
    return String(record?.urn || '');
  }

  setFilter(value: string) {
    this.currentFilter.set(value);
  }

  onSearch() {
    this.searchSignal.set(this.searchTerm);
  }

  async handleAction(r: any, action: string) {
    if (!this.canUpdate()) {
      this.showToast('info', 'Forbidden: current role cannot update status on this queue');
      return;
    }

    let newStatus = '';
    const payload: any = { userId: r.assignedTo };

    switch (action) {
      case 'start-drafting':
        newStatus = 'Drafting';
        payload.notes = this.ts.translate('note.start_drafting');
        break;
      case 'start-checking':
        newStatus = 'Checking Underlying';
        payload.notes = this.ts.translate('note.start_checking');
        break;
      case 'release':
        newStatus = 'Released';
        payload.notes = this.ts.translate('note.release');
        break;

      default:
        return;
    }
    payload.newStatus = newStatus;
    try {
      await this.dataStore.updateLCStatus(r.id, payload);
      this.showToast('success', `${r.urn} → ${newStatus}`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async handleRelease(r: any) {
    if (!this.canRelease()) {
      this.showToast('info', 'Forbidden: current role cannot release L/C');
      return;
    }

    const officerName = this.officerSelections[r.id];
    if (!officerName) {
      this.showToast('info', this.ts.translate('officer_release.select_officer'));
      return;
    }
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: 'Released',
        approvedBy: officerName,
        userId: r.assignedTo,
        notes: `${this.ts.translate('note.release')} (by ${officerName})`,
      });
      delete this.officerSelections[r.id];
      this.showToast('success', `${r.urn} → Released (by ${officerName})`);
    } catch (e: any) {
      this.showToast('info', e.message || 'Release failed');
    }
  }

  async promptMarkException(r: any) {
    if (!this.canUpdate()) {
      this.showToast('info', 'Forbidden: current role cannot mark exception');
      return;
    }
    this.exceptionNote = '';
    this.markingExceptionLc = r;
  }

  async submitMarkException() {
    if (!this.markingExceptionLc) return;
    const r = this.markingExceptionLc;
    const reason = this.exceptionNote;
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: 'Exception',
        exceptionReason: reason,
        userId: r.assignedTo,
        notes: this.ts.translate('note.mark_exception') + (reason ? `: ${reason}` : ''),
      });
      this.showToast('success', `${r.urn} → Exception`);
      this.markingExceptionLc = null;
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async promptReturnStatus(r: any, targetStatus: string) {
    if (!this.canUpdate()) {
      this.showToast('info', 'Forbidden: current role cannot update status');
      return;
    }
    this.returnTargetStatus = targetStatus;
    this.returnNote = '';
    this.returningStatusLc = r;
  }

  async submitReturnStatus() {
    if (!this.returningStatusLc) return;
    const r = this.returningStatusLc;
    const targetStatus = this.returnTargetStatus;
    const note = this.returnNote;
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: targetStatus,
        userId: r.assignedTo,
        notes: `Returned to ${targetStatus}` + (note ? `: ${note}` : ''),
      });
      this.showToast('success', `${r.urn} → ${targetStatus}`);
      this.returningStatusLc = null;
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async promptResolveException(r: any) {
    if (!this.canUpdate()) {
      this.showToast('info', 'Forbidden: current role cannot resolve exception');
      return;
    }

    if (!r.exceptionStartedAt) return;
    const autoMins = Math.round((Date.now() - new Date(r.exceptionStartedAt).getTime()) / 60000);
    this.resolutionMinutes = autoMins;
    this.resolutionNextStatus = r.previousStatus || 'Drafting';
    this.resolvingExceptionLc = r;
  }

  async submitResolveException() {
    if (!this.resolvingExceptionLc) return;
    const r = this.resolvingExceptionLc;
    try {
      await this.dataStore.updateLCStatus(r.id, {
        newStatus: this.resolutionNextStatus,
        exceptionMinutes: this.resolutionMinutes,
        userId: r.assignedTo,
        notes: this.ts.translate('note.resolve_exception'),
      });
      this.showToast('success', `${r.urn} → ${this.resolutionNextStatus}`);
      this.resolvingExceptionLc = null;
    } catch (e: any) {
      this.showToast('info', e.message || 'Action failed');
    }
  }

  async showLcDetails(r: any) {
    this.selectedLc = r;
    this.exceptionHistory = [];
    this.exceptionHistory = await this.dataStore.getLCExceptions(r.id);
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatStartDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  formatTimeLeftToSla(r: any): string {
    const remaining = this.getRemainingSlaMinutes(r);
    if (remaining >= 0) {
      return `${this.formatMinutesCompact(remaining)} ${this.ts.translate('queue.time_left')}`;
    }
    return `${this.ts.translate('queue.time_breached_by')} ${this.formatMinutesCompact(Math.abs(remaining))}`;
  }

  timeLeftColor(r: any): string {
    return this.getRemainingSlaMinutes(r) >= 0 ? 'var(--text-secondary)' : 'var(--danger,#dc2626)';
  }

  statusClass(status: string): string {
    const map: any = {
      'Received': 'received',
      'Drafting': 'drafting',
      'Checking Underlying': 'checking',
      'Released': 'released',
      'Breached': 'breached',
      'Breached with Exception': 'breached',
      'Exception': 'exception'
    };
    return map[status] || 'received';
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

  private getRemainingSlaMinutes(r: any): number {
    let max = this.dataStore.slaConfig().importSlaMaxMinutes;
    if (r.transactionType === 'Export') max = this.dataStore.slaConfig().exportSlaMaxMinutes;
    if (r.transactionType === 'Bank Guarantee') max = this.dataStore.slaConfig().bgSlaMaxMinutes;
    return max - this.getElapsedMinutes(r);
  }

  isAtRisk(r: any): boolean {
    if (r.status === 'Released' || r.status === 'Breached' || r.status === 'Breached with Exception') return false;
    const elapsed = this.getElapsedMinutes(r);
    let max = this.dataStore.slaConfig().importSlaMaxMinutes;
    if (r.transactionType === 'Export') max = this.dataStore.slaConfig().exportSlaMaxMinutes;
    if (r.transactionType === 'Bank Guarantee') max = this.dataStore.slaConfig().bgSlaMaxMinutes;
    return elapsed >= (max * 0.75) && elapsed <= max;
  }

  private formatMinutesCompact(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private showToast(type: 'success' | 'info', message: string) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon">${type === 'success' ? '✓' : 'ℹ'}</div><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
}