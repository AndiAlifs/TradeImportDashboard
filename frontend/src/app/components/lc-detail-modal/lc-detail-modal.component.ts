import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DataStoreService } from '../../services/data-store.service';
import {
  StageDuration,
  LcSummaryInfo,
  buildLcTimelineItems,
  computeLcSummary,
  computeLcStageDurations,
  findLongestStage,
  formatMinutesLabel,
  getTimelineLabel,
} from '../../utils/stage-duration';

@Component({
  selector: 'app-lc-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="modal-overlay" [class.active]="!!lc" (click)="closed.emit()">
      <div class="modal-container form-card" *ngIf="lc" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3>{{ lc.urn }}</h3>
            <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ lc.transactionType }}] {{ lc.subject }}</div>
          </div>
          <button class="modal-close" (click)="closed.emit()">×</button>
        </div>
        <div class="modal-body table-scroll" style="max-height:60vh;padding:1.5rem">

          <!-- Summary strip -->
          <ng-container *ngIf="getLcSummary(lc) as summary">
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.25rem;padding:0.85rem 1rem;background:var(--bg-secondary,#f8f9fa);border-radius:0.5rem;border:1px solid var(--border-color,#e5e7eb)">
              <div style="display:flex;flex-direction:column;gap:0.15rem;min-width:80px">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">{{ 'modal.total_time' | translate }}</div>
                <div style="font-weight:700;font-size:0.95rem">{{ formatMinutesLabel(summary.totalMinutes) }}</div>
              </div>
              <div style="width:1px;background:var(--border-color,#e5e7eb);align-self:stretch"></div>
              <div style="display:flex;flex-direction:column;gap:0.15rem;min-width:70px">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">{{ 'modal.status' | translate }}</div>
                <span [ngClass]="summary.isDone ? 'status-badge released' : 'status-badge drafting'" style="align-self:flex-start;font-size:0.75rem"><span class="dot"></span>{{ (summary.isDone ? 'modal.status_done' : 'modal.status_in_progress') | translate }}</span>
              </div>
              <ng-container *ngIf="summary.exceptionMinutes > 0">
                <div style="width:1px;background:var(--border-color,#e5e7eb);align-self:stretch"></div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;min-width:80px">
                  <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">{{ 'modal.exception' | translate }}</div>
                  <div style="font-weight:700;font-size:0.95rem;color:var(--danger,#dc2626)">{{ formatMinutesLabel(summary.exceptionMinutes) }}</div>
                </div>
              </ng-container>
              <div style="width:1px;background:var(--border-color,#e5e7eb);align-self:stretch"></div>
              <div style="display:flex;flex-direction:column;gap:0.2rem;flex:1;min-width:150px">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">SLA · {{ formatMinutesLabel(summary.slaMaxMinutes) }} {{ 'modal.sla_limit_suffix' | translate }}</div>
                <div style="font-weight:700;font-size:0.9rem" [ngStyle]="{'color': summary.slaGapMinutes >= 0 ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)'}">
                  <ng-container *ngIf="summary.slaGapMinutes >= 0">{{ formatMinutesLabel(summary.slaGapMinutes) }} {{ 'modal.sla_remaining' | translate }} · {{ summary.slaUsedPercent }}{{ 'modal.sla_pct_used' | translate }}</ng-container>
                  <ng-container *ngIf="summary.slaGapMinutes < 0">{{ 'modal.sla_breached' | translate }}{{ formatMinutesLabel(-summary.slaGapMinutes) }} · {{ summary.slaUsedPercent }}{{ 'modal.sla_pct_used' | translate }}</ng-container>
                </div>
              </div>
            </div>
          </ng-container>

          <div class="timeline">
            <ng-container *ngFor="let item of getTimelineItems(lc)">
              <div *ngIf="item.type === 'received'" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(lc.transactionType, 'received') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(lc.receivedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.received' | translate }}</div>
                </div>
              </div>
              <div *ngIf="item.type === 'drafting'" class="timeline-item" [ngClass]="lc.status === 'Drafting' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(lc.transactionType, 'drafting') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(lc.draftingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.drafting' | translate }}{{ lc.assignedTo ? (' ' + ('modal.assigned_by' | translate) + ' ' + lc.assignedTo) : '' }}</div>
                </div>
              </div>
              <div *ngIf="item.type === 'checking'" class="timeline-item" [ngClass]="lc.status === 'Checking Underlying' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(lc.transactionType, 'checking') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(lc.checkingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.checking' | translate }}</div>
                </div>
              </div>
              <div *ngIf="item.type === 'exception'" class="timeline-item" [ngClass]="item.exceptionData?.isActive ? 'exception active' : 'exception completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.exception' | translate }}<ng-container *ngIf="!item.exceptionData?.isActive"> · <span style="color:var(--success,#16a34a);font-size:0.8em">{{ 'timeline.exception_resolved_label' | translate }}</span></ng-container></div>
                  <div class="timeline-time">{{ formatDateTime(item.exceptionData?.startedAt ?? '') }}</div>
                  <div class="timeline-desc">
                    <span *ngIf="item.exceptionData?.reason" style="display:block;margin-bottom:0.4rem">{{ item.exceptionData?.reason }}</span>
                    <span *ngIf="!item.exceptionData?.reason && item.exceptionData?.isActive">{{ 'timeline.desc.exception_active' | translate }}</span>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.25rem;font-size:0.82em;color:var(--text-muted)">
                      <span><strong>{{ 'timeline.exception_start' | translate }}:</strong> {{ formatDateTime(item.exceptionData?.startedAt ?? '') }}</span>
                      <span><strong>{{ 'timeline.exception_end' | translate }}:</strong> <ng-container *ngIf="!item.exceptionData?.isActive && item.exceptionData?.resolvedAt">{{ formatDateTime(item.exceptionData?.resolvedAt ?? '') }}</ng-container><ng-container *ngIf="item.exceptionData?.isActive"><span style="color:var(--warning,#d97706)">{{ 'timeline.live' | translate }}</span></ng-container><ng-container *ngIf="!item.exceptionData?.isActive && !item.exceptionData?.resolvedAt">—</ng-container></span>
                      <span *ngIf="item.exceptionData?.resolutionMinutes && item.exceptionData!.resolutionMinutes! > 0"><strong>{{ 'timeline.exception_duration' | translate }}:</strong> {{ formatExceptionDuration(item.exceptionData!.resolutionMinutes!) }}</span>
                    </div>
                    <ng-container *ngIf="!item.exceptionData?.isActive">
                      <span style="color:var(--text-muted);font-size:0.85em;">{{ 'timeline.desc.exception_resolved' | translate }}</span>
                    </ng-container>
                  </div>
                </div>
              </div>
              <div *ngIf="item.type === 'released'" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(lc.transactionType, 'released') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(lc.releasedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.released' | translate }}</div>
                </div>
              </div>
            </ng-container>
          </div>

          <div class="stage-duration-card" *ngIf="getLcStageDurations(lc).length > 0">
            <div class="stage-duration-header">
              <h4>{{ 'timeline.stage_duration' | translate }}</h4>
              <span *ngIf="getLcBottleneck(lc) as bottleneck" class="stage-duration-pill">
                {{ 'timeline.longest_stage' | translate }}: {{ bottleneck.labelKey | translate }} ({{ formatMinutesLabel(bottleneck.minutes) }})
              </span>
            </div>

            <div class="stage-share-wrap">
              <div class="stage-share-title">{{ 'timeline.stage_share' | translate }}</div>
              <div class="stage-share-bar">
                <div
                  *ngFor="let segment of getStageShareSegments(lc)"
                  class="stage-share-segment"
                  [ngClass]="segment.className"
                  [style.width.%]="segment.percent"
                  [title]="(segment.labelKey | translate) + ' ' + formatPercent(segment.percent) + ' (' + formatMinutesLabel(segment.minutes) + ')'">
                </div>
              </div>
              <div class="stage-share-legend">
                <span class="stage-share-item" *ngFor="let segment of getStageShareSegments(lc)">
                  <span class="stage-share-dot" [ngClass]="segment.className"></span>
                  <span>{{ segment.labelKey | translate }}</span>
                  <strong>{{ formatPercent(segment.percent) }}</strong>
                </span>
              </div>
            </div>

            <div class="stage-duration-list">
              <div class="stage-duration-row" *ngFor="let stage of getLcStageDurations(lc)">
                <div class="stage-duration-label">
                  {{ stage.labelKey | translate }}
                  <span *ngIf="stage.isActive" class="stage-live-tag">{{ 'timeline.live' | translate }}</span>
                </div>
                <div class="stage-duration-track">
                  <div class="stage-duration-fill" [class.longest]="stage.isLongest" [style.width.%]="stageWidth(stage.minutes, lc)"></div>
                </div>
                <div class="stage-duration-value">{{ formatMinutesLabel(stage.minutes) }}</div>
              </div>
            </div>
          </div>

          <div class="stage-duration-card" *ngIf="exceptionHistory.length > 0" style="margin-top: 1rem;">
            <div class="stage-duration-header">
              <h4 style="margin:0;font-size:0.9rem;color:var(--text-primary)">{{ 'timeline.exception_history' | translate }}</h4>
            </div>
            <div class="table-scroll" style="max-height: 200px">
              <table class="data-table" style="font-size:0.75rem;margin-top:0.5rem">
                <thead>
                  <tr>
                    <th style="padding:0.4rem">{{ 'timeline.col_started_at' | translate }}</th>
                    <th style="padding:0.4rem">{{ 'timeline.col_reason' | translate }}</th>
                    <th style="padding:0.4rem">{{ 'timeline.col_resolved_at' | translate }}</th>
                    <th style="padding:0.4rem">{{ 'timeline.col_duration' | translate }}</th>
                    <th style="padding:0.4rem">{{ 'timeline.col_returned_to' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let ex of exceptionHistory">
                    <td style="padding:0.4rem;white-space:nowrap">{{ formatDateTime(ex.startedAt) }}</td>
                    <td style="padding:0.4rem">{{ ex.reason }}</td>
                    <td style="padding:0.4rem;white-space:nowrap">{{ ex.resolvedAt ? formatDateTime(ex.resolvedAt) : '—' }}</td>
                    <td style="padding:0.4rem">{{ ex.resolutionMinutes != null ? ex.resolutionMinutes : '—' }}</td>
                    <td style="padding:0.4rem">{{ ex.resolvedToStatus || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class LcDetailModalComponent {
  @Input() lc: any = null;
  @Input() exceptionHistory: any[] = [];
  @Output() closed = new EventEmitter<void>();

  private dataStore = inject(DataStoreService);

  getTimelineLabel = getTimelineLabel;
  formatMinutesLabel = formatMinutesLabel;

  getLcSummary(lc: any): LcSummaryInfo {
    const sla = this.dataStore.slaConfig();
    let maxMins = sla.importSlaMaxMinutes;
    if (lc?.transactionType === 'Export') maxMins = sla.exportSlaMaxMinutes;
    if (lc?.transactionType === 'Bank Guarantee') maxMins = sla.bgSlaMaxMinutes;
    return computeLcSummary(lc, maxMins);
  }

  getTimelineItems(lc: any) {
    return buildLcTimelineItems(lc, this.exceptionHistory);
  }

  estimateExceptionStart(lc: any): string {
    if (lc.exceptionStartedAt) return lc.exceptionStartedAt;
    if (lc.exceptionResolvedAt && lc.exceptionTotalMinutes > 0) {
      return new Date(new Date(lc.exceptionResolvedAt).getTime() - lc.exceptionTotalMinutes * 60_000).toISOString();
    }
    return '';
  }

  formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatExceptionDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  getLcStageDurations(lc: any): StageDuration[] {
    return computeLcStageDurations(lc);
  }

  getLcBottleneck(lc: any): StageDuration | null {
    return findLongestStage(this.getLcStageDurations(lc));
  }

  stageWidth(minutes: number, lc: any): number {
    const stages = this.getLcStageDurations(lc);
    const maxMinutes = stages.reduce((max, stage) => Math.max(max, stage.minutes), 0);
    if (maxMinutes <= 0) return 0;
    return Math.max(8, Math.round((minutes / maxMinutes) * 100));
  }

  getStageShareSegments(lc: any): Array<{ labelKey: string; percent: number; className: string; minutes: number }> {
    const stages = this.getLcStageDurations(lc);
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
}
