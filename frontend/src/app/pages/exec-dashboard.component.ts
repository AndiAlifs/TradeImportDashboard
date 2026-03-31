import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardDateRange, DataStoreService } from '../services/data-store.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { StageDuration, computeAverageStageDurations, computeLcStageDurations, findLongestStage, formatMinutesLabel, getTimelineLabel, getChartLabel } from '../utils/stage-duration';

type SlaComparisonMetric = 'overall' | 'import' | 'export' | 'bg' | 'all';

@Component({
  selector: 'app-exec-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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

      <div class="exec-sla-compare">
        <div class="exec-sla-compare-header">
          <div>
            <h3>{{ 'exec.sla_compare_title' | translate }}</h3>
            <p>{{ comparisonRangeSummary() }}</p>
            <p class="exec-sla-compare-note" [attr.title]="'exec.sla_compare_server_note' | translate">{{ 'exec.sla_compare_server_note' | translate }}</p>
          </div>
          <label class="exec-sla-compare-select-wrap">
            <span>{{ 'exec.sla_compare_selector' | translate }}</span>
            <select class="exec-sla-compare-select" [value]="comparisonMetric()" (change)="setComparisonMetric($any($event.target).value)">
              <option *ngFor="let option of comparisonOptions" [value]="option.value">{{ option.labelKey | translate }}</option>
            </select>
          </label>
        </div>

        <div class="exec-sla-compare-loading" *ngIf="comparisonLoading()">
          {{ 'exec.sla_compare_loading' | translate }}
        </div>

        <div class="exec-sla-compare-grid" *ngIf="!comparisonLoading()">
          <div class="exec-sla-compare-card" *ngFor="let row of comparisonRows()">
            <div class="exec-sla-compare-card-label">{{ row.labelKey | translate }}</div>
            <div class="exec-sla-compare-main">{{ row.current }}%</div>
            <div class="exec-sla-compare-detail">{{ 'exec.sla_compare_previous' | translate }}: {{ row.previous }}%</div>
            <div class="exec-sla-compare-bars" aria-hidden="true">
              <div class="exec-sla-compare-bar-row">
                <span>{{ 'exec.sla_compare_current' | translate }}</span>
                <div class="exec-sla-compare-track"><div class="exec-sla-compare-fill current" [style.width.%]="comparisonBarWidth(row.current)"></div></div>
              </div>
              <div class="exec-sla-compare-bar-row">
                <span>{{ 'exec.sla_compare_previous' | translate }}</span>
                <div class="exec-sla-compare-track"><div class="exec-sla-compare-fill previous" [style.width.%]="comparisonBarWidth(row.previous)"></div></div>
              </div>
            </div>
            <div class="exec-sla-compare-delta" [ngClass]="row.trendClass">
              {{ row.deltaText }} pp · {{ row.trendKey | translate }}
            </div>
          </div>
        </div>
      </div>

      <!-- Executive KPI Cards -->
      <div class="kpi-grid exec-kpi-grid">
        <div class="kpi-card accent">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">{{ importProcessed() }}</div>
          <div class="kpi-label">{{ 'exec.import_processed' | translate }}</div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-icon">🚢</div>
          <div class="kpi-value">{{ exportProcessed() }}</div>
          <div class="kpi-label">{{ 'exec.export_processed' | translate }}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-icon">📊</div>
          <div class="kpi-value">{{ importSla() }}%</div>
          <div class="kpi-label">{{ 'exec.import_sla' | translate }}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value">{{ exportSla() }}%</div>
          <div class="kpi-label">{{ 'exec.export_sla' | translate }}</div>
        </div>
        <div class="kpi-card success" style="grid-column: span 1.5;">
          <div class="kpi-icon">🛡️</div>
          <div class="kpi-value">{{ bgSla() }}%</div>
          <div class="kpi-label">{{ 'exec.bg_sla' | translate }}</div>
        </div>
        <div class="kpi-card danger">
          <div class="kpi-icon">🚨</div>
          <div class="kpi-value">{{ totalBreaches() }}</div>
          <div class="kpi-label">{{ 'exec.total_breaches' | translate }}</div>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-icon">⏱️</div>
          <div class="kpi-value">{{ avgCycleTime() }}m</div>
          <div class="kpi-label">{{ 'exec.avg_time' | translate }}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Import vs Export Comparison Chart -->
        <div class="comparison-chart">
          <h3>{{ 'exec.comparison_title' | translate }}</h3>
          <div class="comparison-section">
            <div class="comparison-group" *ngFor="let stage of comparisonStages()">
              <div class="comparison-label">{{ stage.label | translate }}</div>
              <div class="comparison-bars">
                <div class="comparison-bar-row">
                  <span class="comp-type-label import-label">
                    {{ 'exec.import_label' | translate }}
                    <small style="display:block;font-size:0.75em;opacity:0.8;margin-top:2px;line-height:1">{{ getChartLabel('Import', stage.key) | translate }}</small>
                  </span>
                  <div class="bar-track"><div class="bar-fill purple" [style.width.%]="barPctByStage(stage.importVal, stage.stageMax)">{{ stage.importVal }} min</div></div>
                </div>
                <div class="comparison-bar-row">
                  <span class="comp-type-label export-label">
                    {{ 'exec.export_label' | translate }}
                    <small style="display:block;font-size:0.75em;opacity:0.8;margin-top:2px;line-height:1">{{ getChartLabel('Export', stage.key) | translate }}</small>
                  </span>
                  <div class="bar-track"><div class="bar-fill teal" [style.width.%]="barPctByStage(stage.exportVal, stage.stageMax)">{{ stage.exportVal }} min</div></div>
                </div>
                <div class="comparison-bar-row">
                  <span class="comp-type-label bg-label" style="color:var(--info);border-color:var(--info);background:transparent">
                    {{ 'exec.bg_label' | translate }}
                    <small style="display:block;font-size:0.75em;opacity:0.8;margin-top:2px;line-height:1">{{ getChartLabel('Bank Guarantee', stage.key) | translate }}</small>
                  </span>
                  <div class="bar-track"><div class="bar-fill info" [style.width.%]="barPctByStage(stage.bgVal, stage.stageMax)">{{ stage.bgVal }} min</div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bottleneck-panel">
            <div class="bottleneck-title">{{ 'exec.bottleneck_title' | translate }}</div>
            <div class="insight-chip-grid">
              <div class="insight-chip">
                <div class="insight-chip-label">{{ 'exec.insight_import_top' | translate }}</div>
                <div class="insight-chip-value" *ngIf="importBottleneckStage(); else noImportTop">
                  {{ importBottleneckStage()!.labelKey | translate }} · {{ importBottleneckStage()!.minutes }}m
                </div>
                <ng-template #noImportTop>
                  <div class="insight-chip-empty">{{ 'exec.bottleneck_empty' | translate }}</div>
                </ng-template>
                <div class="insight-metric" *ngIf="importTopGap() > 0">
                  <div class="insight-metric-row">
                    <span>{{ 'exec.insight_gap_next' | translate }}</span>
                    <strong>{{ importTopGap() }}m</strong>
                  </div>
                  <div class="insight-delta-track">
                    <div class="insight-delta-fill" [style.width.%]="gapPct(importTopGap(), maxTopGap())"></div>
                  </div>
                </div>
              </div>

              <div class="insight-chip">
                <div class="insight-chip-label">{{ 'exec.insight_export_top' | translate }}</div>
                <div class="insight-chip-value" *ngIf="exportBottleneckStage(); else noExportTop">
                  {{ exportBottleneckStage()!.labelKey | translate }} · {{ exportBottleneckStage()!.minutes }}m
                </div>
                <ng-template #noExportTop>
                  <div class="insight-chip-empty">{{ 'exec.bottleneck_empty' | translate }}</div>
                </ng-template>
                <div class="insight-metric" *ngIf="exportTopGap() > 0">
                  <div class="insight-metric-row">
                    <span>{{ 'exec.insight_gap_next' | translate }}</span>
                    <strong>{{ exportTopGap() }}m</strong>
                  </div>
                  <div class="insight-delta-track">
                    <div class="insight-delta-fill" [style.width.%]="gapPct(exportTopGap(), maxTopGap())"></div>
                  </div>
                </div>
              </div>

              <div class="insight-chip">
                <div class="insight-chip-label">{{ 'exec.insight_bg_top' | translate }}</div>
                <div class="insight-chip-value" *ngIf="bgBottleneckStage(); else noBgTop">
                  {{ bgBottleneckStage()!.labelKey | translate }} · {{ bgBottleneckStage()!.minutes }}m
                </div>
                <ng-template #noBgTop>
                  <div class="insight-chip-empty">{{ 'exec.bottleneck_empty' | translate }}</div>
                </ng-template>
                <div class="insight-metric" *ngIf="bgTopGap() > 0">
                  <div class="insight-metric-row">
                    <span>{{ 'exec.insight_gap_next' | translate }}</span>
                    <strong>{{ bgTopGap() }}m</strong>
                  </div>
                  <div class="insight-delta-track">
                    <div class="insight-delta-fill" [style.width.%]="gapPct(bgTopGap(), maxTopGap())"></div>
                  </div>
                </div>
              </div>

              <div class="insight-chip span-3" *ngIf="crossBottleneckDelta() as delta">
                <div class="insight-chip-label">{{ 'exec.insight_cross_delta' | translate }}</div>
                <div class="insight-metric-row">
                  <span class="insight-chip-value">{{ delta.leadingType | translate }}</span>
                  <strong class="insight-chip-value">{{ delta.minutes }}m</strong>
                </div>
                <div class="insight-delta-track">
                  <div class="insight-delta-fill strong" [style.width.%]="gapPct(delta.minutes, maxCrossDelta())"></div>
                </div>
                <div class="insight-stage-tag" *ngIf="delta.stageLabelKey">{{ delta.stageLabelKey | translate }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Summary Card -->
        <div class="ai-summary-card">
          <div class="ai-summary-header">
            <h3>{{ 'exec.ai_title' | translate }}</h3>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span class="ai-tag">AI Generated</span>
            </div>
          </div>
          <div class="ai-summary-content" *ngIf="aiSummary() as ai">
            <div class="ai-insight">
              <div class="ai-health" [ngClass]="ai.healthClass">
                <span class="health-label">Overall Health:</span>
                <span class="health-value">{{ ai.healthStatus }}</span>
                <span class="health-detail">({{ ai.overallCompliance }}% SLA compliance)</span>
              </div>
            </div>
            <div class="ai-insight">
              <strong>📊 Overview:</strong> {{ ai.activeCount }} active L/Cs, {{ ai.releasedCount }} completed today. Average cycle time: <strong>{{ avgCycleTime() }} min</strong> against SLA target of {{ ai.slaTarget }}.
            </div>
            <div class="ai-insight">
              <strong>📦 Import Performance:</strong> SLA compliance at <strong>{{ importSla() }}%</strong> with {{ importBreachCount() }} breach{{ importBreachCount() !== 1 ? 'es' : '' }}. {{ ai.importBottleneckText }}
            </div>
            <div class="ai-insight">
              <strong>🚢 Export Performance:</strong> SLA compliance at <strong>{{ exportSla() }}%</strong> with {{ exportBreachCount() }} breach{{ exportBreachCount() !== 1 ? 'es' : '' }}. {{ ai.exportBottleneckText }}
            </div>
            <div class="ai-insight">
              <strong>🛡️ BG Performance:</strong> SLA compliance at <strong>{{ bgSla() }}%</strong> with {{ bgBreachCount() }} breach{{ bgBreachCount() !== 1 ? 'es' : '' }}. {{ ai.bgBottleneckText }}
            </div>
            <div class="ai-insight">
              <strong>💡 Recommendation:</strong> {{ ai.recommendation }}
            </div>
          </div>
        </div>
      </div>

      <!-- Staff & Officer Performance -->
      <div class="data-table-wrapper" style="margin-top:1.25rem">
        <div class="table-header">
          <h3>{{ 'exec.staff_performance_title' | translate }}</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ 'exec.col_name' | translate }}</th>
              <th>{{ 'exec.col_role' | translate }}</th>
              <th>{{ 'exec.col_volume' | translate }}</th>
              <th>{{ 'exec.col_breaches' | translate }}</th>
              <th>{{ 'exec.col_compliance' | translate }}</th>
              <th>{{ 'exec.col_avg_time' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (s of staffPerformance(); track s.name) {
              <tr>
                <td><strong>{{ s.name }}</strong></td>
                <td><span class="status-badge" [ngClass]="s.role === 'Officer' ? 'checking' : 'received'">{{ s.role }}</span></td>
                <td [style.background]="'linear-gradient(to right, var(--accent-glow) ' + (s.volume / maxStaffVolume() * 100) + '%, transparent 0)'" style="background-clip: padding-box;">
                  <a class="urn-link" (click)="showVolumeDetails(s)"><strong>{{ s.volume }}</strong></a>
                </td>
                <td style="cursor: pointer" (click)="showBreachDetails(s)" [style.color]="s.breaches > 0 ? 'var(--danger)' : 'var(--text-secondary)'">
                  <strong *ngIf="s.breaches > 0" style="text-decoration:underline">{{ s.breaches }}</strong>
                  <span *ngIf="s.breaches === 0">{{ s.breaches }}</span>
                </td>
                <td [style.color]="s.compliancePct < 90 ? 'var(--danger)' : 'var(--success)'" [style.background]="s.compliancePct < 90 ? 'linear-gradient(to right, rgba(239, 68, 68, 0.1) ' + s.compliancePct + '%, transparent 0)' : 'linear-gradient(to right, rgba(16, 185, 129, 0.1) ' + s.compliancePct + '%, transparent 0)'" style="background-clip: padding-box;"><strong>{{ s.compliancePct }}%</strong></td>
                <td>{{ s.avgTime > 0 ? s.avgTime + 'm' : '—' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'recent.empty' | translate }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Volume L/Cs Modal -->
      <div class="modal-overlay" [class.active]="!!selectedVolumeStats" (click)="selectedVolumeStats = null">
        <div class="modal-container form-card" *ngIf="selectedVolumeStats" (click)="$event.stopPropagation()" style="max-width:760px">
          <div class="modal-header">
            <div>
              <h3 style="margin:0;font-size:1rem">Volume: {{ selectedVolumeStats.name }} ({{ selectedVolumeStats.role }})</h3>
            </div>
            <button class="modal-close" (click)="selectedVolumeStats = null">×</button>
          </div>
          <div class="modal-body table-scroll" style="max-height:420px;padding:0">
            <table class="data-table" style="font-size:0.8rem">
              <thead>
                <tr>
                  <th style="padding:0.6rem 1rem">URN</th>
                  <th style="padding:0.6rem 1rem">Type</th>
                  <th style="padding:0.6rem 1rem">Status</th>
                  <th style="padding:0.6rem 1rem">Assigned</th>
                  <th style="padding:0.6rem 1rem">Approved</th>
                </tr>
              </thead>
              <tbody>
                @for (r of selectedVolumeStats.relatedLcs; track r.id || r.urn) {
                  <tr>
                    <td style="padding:0.6rem 1rem"><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                    <td style="padding:0.6rem 1rem">{{ r.transactionType || '—' }}</td>
                    <td style="padding:0.6rem 1rem"><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                    <td style="padding:0.6rem 1rem">{{ r.assignedTo || '—' }}</td>
                    <td style="padding:0.6rem 1rem">{{ r.approvedBy || '—' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem">{{ 'recent.empty' | translate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Breached L/Cs Modal -->
      <div class="modal-overlay" [class.active]="!!selectedBreachStats" (click)="selectedBreachStats = null">
        <div class="modal-container form-card" *ngIf="selectedBreachStats" (click)="$event.stopPropagation()" style="max-width:500px">
          <div class="modal-header">
            <div>
              <h3 style="margin:0;font-size:1rem">{{ 'exec.col_breaches' | translate }}: {{ selectedBreachStats.name }} ({{ selectedBreachStats.role }})</h3>
            </div>
            <button class="modal-close" (click)="selectedBreachStats = null">×</button>
          </div>
          <div class="modal-body table-scroll" style="max-height:300px;padding:0">
            <table class="data-table" style="font-size:0.8rem">
              <thead>
                <tr>
                  <th style="padding:0.6rem 1rem">URN</th>
                  <th style="padding:0.6rem 1rem">Status</th>
                  <th style="padding:0.6rem 1rem">Elapsed</th>
                </tr>
              </thead>
              <tbody>
                @for (r of selectedBreachStats.breachedLcs; track r.id || r.urn) {
                  <tr>
                    <td style="padding:0.6rem 1rem"><a class="urn-link" (click)="showLcDetails(r)"><strong>{{ r.urn }}</strong></a></td>
                    <td style="padding:0.6rem 1rem"><span class="status-badge" [ngClass]="statusClass(r.status)"><span class="dot"></span>{{ r.status }}</span></td>
                    <td class="elapsed-time" style="padding:0.6rem 1rem">{{ formatElapsed(r) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem">{{ 'recent.empty' | translate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- LC Detail Modal -->
      <div class="modal-overlay" [class.active]="!!selectedLc" (click)="selectedLc = null">
        <div class="modal-container form-card" *ngIf="selectedLc" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ selectedLc.urn }}</h3>
              <div style="font-size:0.75rem;color:var(--text-secondary)">[{{ selectedLc.transactionType }}] {{ selectedLc.subject }}</div>
            </div>
            <button class="modal-close" (click)="selectedLc = null">×</button>
          </div>
          <div class="modal-body table-scroll" style="max-height:60vh;padding:1.5rem">
            <div class="timeline">
              <div *ngIf="selectedLc.receivedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(selectedLc!.transactionType, 'received') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.receivedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.received' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.draftingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Drafting' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(selectedLc!.transactionType, 'drafting') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.draftingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.drafting' | translate }}{{ selectedLc.assignedTo ? ' by ' + selectedLc.assignedTo : '' }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.checkingStartedAt" class="timeline-item" [ngClass]="selectedLc.status === 'Checking Underlying' ? 'active' : 'completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(selectedLc!.transactionType, 'checking') | translate }}</div>
                  <div class="timeline-time">{{ formatDateTime(selectedLc.checkingStartedAt) }}</div>
                  <div class="timeline-desc">{{ 'timeline.desc.checking' | translate }}</div>
                </div>
              </div>
              <div *ngIf="selectedLc.exceptionStartedAt || selectedLc.exceptionTotalMinutes > 0" class="timeline-item" [ngClass]="selectedLc.status === 'Exception' ? 'exception active' : 'exception completed'">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ 'timeline.exception' | translate }}<ng-container *ngIf="selectedLc.status !== 'Exception'"> · <span style="color:var(--success,#16a34a);font-size:0.8em">{{ 'timeline.exception_resolved_label' | translate }}</span></ng-container></div>
                  <div class="timeline-time">{{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</div>
                  <div class="timeline-desc">
                    <span *ngIf="selectedLc.exceptionReason" style="display:block;margin-bottom:0.4rem">{{ selectedLc.exceptionReason }}</span>
                    <span *ngIf="!selectedLc.exceptionReason && selectedLc.status === 'Exception'">{{ 'timeline.desc.exception_active' | translate }}</span>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.25rem;font-size:0.82em;color:var(--text-muted)">
                      <span><strong>{{ 'timeline.exception_start' | translate }}:</strong> {{ selectedLc.exceptionStartedAt ? formatDateTime(selectedLc.exceptionStartedAt) : '—' }}</span>
                      <span><strong>{{ 'timeline.exception_end' | translate }}:</strong> <ng-container *ngIf="selectedLc.status !== 'Exception' && selectedLc.exceptionResolvedAt">{{ formatDateTime(selectedLc.exceptionResolvedAt) }}</ng-container><ng-container *ngIf="selectedLc.status === 'Exception'"><span style="color:var(--warning,#d97706)">{{ 'timeline.live' | translate }}</span></ng-container><ng-container *ngIf="selectedLc.status !== 'Exception' && !selectedLc.exceptionResolvedAt">—</ng-container></span>
                      <span *ngIf="selectedLc.exceptionTotalMinutes > 0"><strong>{{ 'timeline.exception_duration' | translate }}:</strong> {{ formatExceptionDuration(selectedLc.exceptionTotalMinutes) }}</span>
                    </div>
                    <ng-container *ngIf="selectedLc.status !== 'Exception'">
                      <span style="color:var(--text-muted);font-size:0.85em;">{{ 'timeline.desc.exception_resolved' | translate }}</span>
                    </ng-container>
                  </div>
                </div>
              </div>
              <div *ngIf="selectedLc.releasedAt" class="timeline-item completed">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ getTimelineLabel(selectedLc!.transactionType, 'released') | translate }}</div>
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
                    @for (ex of exceptionHistory; track ex.id || $index) {
                      <tr>
                        <td style="padding:0.4rem;white-space:nowrap">{{ formatDateTime(ex.startedAt) }}</td>
                        <td style="padding:0.4rem">{{ ex.reason }}</td>
                        <td style="padding:0.4rem;white-space:nowrap">{{ ex.resolvedAt ? formatDateTime(ex.resolvedAt) : '—' }}</td>
                        <td style="padding:0.4rem">{{ ex.resolutionMinutes != null ? ex.resolutionMinutes : '—' }}</td>
                        <td style="padding:0.4rem">{{ ex.resolvedToStatus || '—' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem">{{ 'recent.empty' | translate }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Combined Recent Activity -->
      <div class="data-table-wrapper" style="margin-top:1.25rem">
        <div class="table-header">
          <h3>{{ 'exec.combined_activity' | translate }}</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ 'recent.col_time' | translate }}</th>
              <th>{{ 'recent.col_event' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of recentEvents(); track e.id || $index) {
              <tr>
                <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">{{ formatTime(e.timestamp) }}</td>
                <td><strong>{{ e.urn }}</strong> → {{ e.to }} <span style="color:var(--text-muted);font-size:0.75rem">by {{ e.user }}</span></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">{{ 'recent.empty' | translate }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

    </div>
  `
})
export class ExecDashboardComponent implements OnInit {
  getTimelineLabel = getTimelineLabel;
  getChartLabel = getChartLabel;

  private dataStore = inject(DataStoreService);
  private ts = inject(TranslationService);
  private readonly comparisonMetricStorageKey = 'shila_exec_sla_compare_metric';

  selectedVolumeStats: any = null;
  selectedBreachStats: any = null;
  selectedLc: any = null;
  exceptionHistory: any[] = [];

  readonly presets: Array<{ value: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'; labelKey: string }> = [
    { value: 'today', labelKey: 'date.today' },
    { value: 'yesterday', labelKey: 'date.yesterday' },
    { value: 'last7days', labelKey: 'date.last_7_days' },
    { value: 'last14days', labelKey: 'date.last_14_days' },
    { value: 'last1month', labelKey: 'date.last_month' },
  ];
  customFrom = '';
  customTo = '';

  readonly comparisonOptions: Array<{ value: SlaComparisonMetric; labelKey: string }> = [
    { value: 'overall', labelKey: 'exec.sla_compare_overall' },
    { value: 'import', labelKey: 'exec.sla_compare_import' },
    { value: 'export', labelKey: 'exec.sla_compare_export' },
    { value: 'bg', labelKey: 'exec.sla_compare_bg' },
    { value: 'all', labelKey: 'exec.sla_compare_all' },
  ];

  range = computed(() => this.dataStore.executiveDateRange());
  comparisonMetric = signal<SlaComparisonMetric>(this.loadComparisonMetric());
  comparisonLoading = signal<boolean>(false);
  private comparisonCurrentRecords = signal<any[]>([]);
  private comparisonPreviousRecords = signal<any[]>([]);

  private importData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === 'Import'));
  private exportData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === 'Export'));
  private bgData = computed(() => this.dataStore.lcs().filter(r => r.transactionType === 'Bank Guarantee'));
  private sla = computed(() => this.dataStore.slaConfig());

  importProcessed = computed(() => this.importData().length);
  exportProcessed = computed(() => this.exportData().length);
  bgProcessed = computed(() => this.bgData().length);

  importBreachCount = computed(() => this.countBreaches(this.importData(), this.sla().importSlaMaxMinutes));
  exportBreachCount = computed(() => this.countBreaches(this.exportData(), this.sla().exportSlaMaxMinutes));
  bgBreachCount = computed(() => this.countBreaches(this.bgData(), this.sla().bgSlaMaxMinutes));
  totalBreaches = computed(() => this.importBreachCount() + this.exportBreachCount() + this.bgBreachCount());

  importSla = computed(() => {
    const total = this.importData().length;
    return total > 0 ? Math.round(((total - this.importBreachCount()) / total) * 100) : 0;
  });

  exportSla = computed(() => {
    const total = this.exportData().length;
    return total > 0 ? Math.round(((total - this.exportBreachCount()) / total) * 100) : 0;
  });

  bgSla = computed(() => {
    const total = this.bgData().length;
    return total > 0 ? Math.round(((total - this.bgBreachCount()) / total) * 100) : 0;
  });

  avgCycleTime = computed(() => {
    const released = this.dataStore.lcs().filter(r => r.status === 'Released' && r.releasedAt);
    if (released.length === 0) return 0;
    const totalMin = released.reduce((sum, r) => sum + Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000), 0);
    return Math.round(totalMin / released.length);
  });

  staffPerformance = computed(() => {
    const lcs = this.dataStore.lcs();
    const sla = this.sla();
    const map = new Map<string, any>();
    
    lcs.forEach(r => {
      if (!r.assignedTo) return;
      const key = `Staff-${r.assignedTo}`;
      if (!map.has(key)) map.set(key, { name: r.assignedTo, role: 'Staff', volume: 0, breaches: 0, totalMins: 0, timeCount: 0, breachedLcs: [], relatedLcs: [] });
      const stats = map.get(key);
      stats.volume++;
      stats.relatedLcs.push(r);
      const elapsed = this.getElapsedMinutes(r);
      let localSlaMinutes = sla.importSlaMaxMinutes;
      if (r.transactionType === 'Export') localSlaMinutes = sla.exportSlaMaxMinutes;
      if (r.transactionType === 'Bank Guarantee') localSlaMinutes = sla.bgSlaMaxMinutes;

      const isBreached = elapsed > localSlaMinutes || r.status === 'Breached' || r.status === 'Breached with Exception';
      if (isBreached) {
        stats.breaches++;
        stats.breachedLcs.push(r);
      }
      
      if (r.status === 'Released') {
         stats.totalMins += this.getElapsedMinutes(r);
         stats.timeCount++;
      }
    });

    lcs.forEach(r => {
      if (!r.approvedBy) return;
      const key = `Officer-${r.approvedBy}`;
      if (!map.has(key)) map.set(key, { name: r.approvedBy, role: 'Officer', volume: 0, breaches: 0, totalMins: 0, timeCount: 0, breachedLcs: [], relatedLcs: [] });
      const stats = map.get(key);
      stats.volume++;
      stats.relatedLcs.push(r);
      const elapsed = this.getElapsedMinutes(r);
      let localSlaMinutes = sla.importSlaMaxMinutes;
      if (r.transactionType === 'Export') localSlaMinutes = sla.exportSlaMaxMinutes;
      if (r.transactionType === 'Bank Guarantee') localSlaMinutes = sla.bgSlaMaxMinutes;

      const isBreached = elapsed > localSlaMinutes || r.status === 'Breached' || r.status === 'Breached with Exception';
      if (isBreached) {
        stats.breaches++;
        stats.breachedLcs.push(r);
      }
      if (r.status === 'Released') {
         stats.totalMins += this.getElapsedMinutes(r);
         stats.timeCount++;
      }
    });

    return Array.from(map.values()).map(s => {
      return {
        ...s,
        compliancePct: s.volume > 0 ? Math.round(((s.volume - s.breaches) / s.volume) * 100) : 100,
        avgTime: s.timeCount > 0 ? Math.round(s.totalMins / s.timeCount) : 0
      };
    }).sort((a,b) => b.volume - a.volume);
  });

  maxStaffVolume = computed(() => {
    const staff = this.staffPerformance();
    if (staff.length === 0) return 1;
    return Math.max(...staff.map(s => s.volume));
  });

  recentEvents = computed(() => this.dataStore.events().slice(0, 8));

  importStageAverages = computed(() => computeAverageStageDurations(this.importData()));
  exportStageAverages = computed(() => computeAverageStageDurations(this.exportData()));
  bgStageAverages = computed(() => computeAverageStageDurations(this.bgData()));

  importBottleneckStage = computed(() => findLongestStage(this.importStageAverages()));
  exportBottleneckStage = computed(() => findLongestStage(this.exportStageAverages()));
  bgBottleneckStage = computed(() => findLongestStage(this.bgStageAverages()));

  comparisonStages = computed(() => {
    const imp = this.mapStagesForComparison(this.importStageAverages());
    const exp = this.mapStagesForComparison(this.exportStageAverages());
    const bg = this.mapStagesForComparison(this.bgStageAverages());
    const stageMax = (a: number, b: number, c: number) => Math.max(1, a, b, c);
    return [
      { key: 'inbox', label: 'chart.inbox', importVal: imp.inbox, exportVal: exp.inbox, bgVal: bg.inbox, stageMax: stageMax(imp.inbox, exp.inbox, bg.inbox) },
      { key: 'drafting', label: 'chart.drafting', importVal: imp.drafting, exportVal: exp.drafting, bgVal: bg.drafting, stageMax: stageMax(imp.drafting, exp.drafting, bg.drafting) },
      { key: 'checking', label: 'chart.checking', importVal: imp.checking, exportVal: exp.checking, bgVal: bg.checking, stageMax: stageMax(imp.checking, exp.checking, bg.checking) },
      { key: 'total', label: 'chart.total', importVal: imp.total, exportVal: exp.total, bgVal: bg.total, stageMax: stageMax(imp.total, exp.total, bg.total) },
    ];
  });

  importTopGap = computed(() => this.topGap(this.importStageAverages()));
  exportTopGap = computed(() => this.topGap(this.exportStageAverages()));
  bgTopGap = computed(() => this.topGap(this.bgStageAverages()));
  maxTopGap = computed(() => Math.max(1, this.importTopGap(), this.exportTopGap(), this.bgTopGap()));
  maxCrossDelta = computed(() => {
    const importTop = this.importBottleneckStage()?.minutes || 0;
    const exportTop = this.exportBottleneckStage()?.minutes || 0;
    const bgTop = this.bgBottleneckStage()?.minutes || 0;
    return Math.max(1, importTop, exportTop, bgTop);
  });

  crossBottleneckDelta = computed(() => {
    const tops = [
      { type: 'exec.import_label', top: this.importBottleneckStage() },
      { type: 'exec.export_label', top: this.exportBottleneckStage() },
      { type: 'exec.bg_label', top: this.bgBottleneckStage() }
    ].filter(t => t.top !== null) as Array<{type: string; top: StageDuration}>;

    if (tops.length < 2) return null;
    tops.sort((a,b) => b.top.minutes - a.top.minutes);

    const first = tops[0];
    const second = tops[1];
    
    if (first.top.minutes === second.top.minutes) {
       return { leadingType: 'exec.bottleneck_balanced', minutes: 0, stageLabelKey: first.top.labelKey };
    }
    
    return {
      leadingType: first.type,
      minutes: Math.abs(first.top.minutes - second.top.minutes),
      stageLabelKey: first.top.labelKey,
    };
  });

  comparisonRows = computed(() => {
    const current = this.computeSlaMetrics(this.comparisonCurrentRecords());
    const previous = this.computeSlaMetrics(this.comparisonPreviousRecords());
    const allRows = [
      this.createComparisonRow('overall', 'exec.sla_compare_overall', current.overall, previous.overall),
      this.createComparisonRow('import', 'exec.sla_compare_import', current.import, previous.import),
      this.createComparisonRow('export', 'exec.sla_compare_export', current.export, previous.export),
      this.createComparisonRow('bg', 'exec.sla_compare_bg', current.bg, previous.bg),
    ];

    if (this.comparisonMetric() === 'all') {
      return allRows;
    }
    return allRows.filter((row) => row.metric === this.comparisonMetric());
  });

  aiSummary = computed(() => {
    const data = this.dataStore.lcs();
    const sla = this.sla();
    const totalBreaches = this.totalBreaches();
    const activeCount = data.filter(r => r.status !== 'Released').length;
    const releasedCount = data.filter(r => r.status === 'Released').length;
    const overallCompliance = data.length > 0 ? Math.round(((data.length - totalBreaches) / data.length) * 100) : 100;

    let healthStatus = '🟢 Excellent';
    let healthClass = 'health-good';
    if (overallCompliance < 90) { healthStatus = '🟡 Moderate'; healthClass = 'health-moderate'; }
    if (overallCompliance < 75) { healthStatus = '🔴 Critical'; healthClass = 'health-critical'; }

    const slaTarget = `Import <= ${sla.importSlaMaxMinutes}m, Export <= ${sla.exportSlaMaxMinutes}m, BG <= ${sla.bgSlaMaxMinutes}m`;

    const importBottleneck = this.importBottleneckStage();
    const exportBottleneck = this.exportBottleneckStage();
    const bgBottleneck = this.bgBottleneckStage();
    const importBottleneckText = importBottleneck
      ? `Primary bottleneck: ${this.stageName(importBottleneck.labelKey)} (avg ${importBottleneck.minutes} min).`
      : 'Insufficient data for bottleneck analysis.';
    const exportBottleneckText = exportBottleneck
      ? `Primary bottleneck: ${this.stageName(exportBottleneck.labelKey)} (avg ${exportBottleneck.minutes} min).`
      : 'Insufficient data for bottleneck analysis.';
    const bgBottleneckText = bgBottleneck
      ? `Primary bottleneck: ${this.stageName(bgBottleneck.labelKey)} (avg ${bgBottleneck.minutes} min).`
      : 'Insufficient data for bottleneck analysis.';

    const impVol = this.importData().length;
    const expVol = this.exportData().length;
    const bgVol = this.bgData().length;
    let volumeInsight = `Processing volumes — Import: ${impVol}, Export: ${expVol}, BG: ${bgVol}.`;
    
    let recommendation = volumeInsight;
    if (totalBreaches > 0) {
      const bCounts = [
          { type: 'Import', count: this.importBreachCount(), bottleneck: importBottleneck },
          { type: 'Export', count: this.exportBreachCount(), bottleneck: exportBottleneck },
          { type: 'Bank Guarantee', count: this.bgBreachCount(), bottleneck: bgBottleneck }
      ].sort((a,b) => b.count - a.count);
      
      const focus = bCounts[0];
      const focusStage = focus.bottleneck ? this.stageName(focus.bottleneck.labelKey) : this.ts.translate('exec.bottleneck_empty');
      recommendation += ` Focus on reducing ${focus.type} ${focusStage} times to improve overall SLA compliance.`;
    } else {
      recommendation += ' All operations within target — maintain current performance.';
    }

    return { healthStatus, healthClass, overallCompliance, activeCount, releasedCount, slaTarget, importBottleneckText, exportBottleneckText, bgBottleneckText, recommendation };
  });

  barPct(value: number): number {
    return Math.min(100, Math.max(5, (Math.abs(value) / 180) * 100));
  }

  barPctByStage(value: number, stageMax: number): number {
    if (stageMax <= 0) return 0;
    return Math.min(100, Math.max(5, (Math.abs(value) / stageMax) * 100));
  }

  gapPct(value: number, maxValue: number): number {
    if (maxValue <= 0 || value <= 0) return 0;
    return Math.min(100, Math.max(3, (Math.abs(value) / maxValue) * 100));
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  private countBreaches(records: any[], maxSla: number): number {
    return records.filter(r => {
      const elapsed = this.getElapsedMinutes(r);
      return elapsed > maxSla || r.status === 'Breached' || r.status === 'Breached with Exception';
    }).length;
  }

  private computeSlaMetrics(records: any[]): { overall: number; import: number; export: number, bg: number } {
    const importRecords = records.filter((record) => record.transactionType === 'Import');
    const exportRecords = records.filter((record) => record.transactionType === 'Export');
    const bgRecords = records.filter((record) => record.transactionType === 'Bank Guarantee');
    return {
      overall: this.computeOverallSlaPercentage(records),
      import: this.computeSlaPercentage(importRecords, this.sla().importSlaMaxMinutes),
      export: this.computeSlaPercentage(exportRecords, this.sla().exportSlaMaxMinutes),
      bg: this.computeSlaPercentage(bgRecords, this.sla().bgSlaMaxMinutes),
    };
  }
  
  private computeOverallSlaPercentage(records: any[]): number {
      const total = records.length;
      if (total === 0) return 0;
      let breaches = 0;
      records.forEach(r => {
          let maxSla = 120;
          if (r.transactionType === 'Import') maxSla = this.sla().importSlaMaxMinutes;
          if (r.transactionType === 'Export') maxSla = this.sla().exportSlaMaxMinutes;
          if (r.transactionType === 'Bank Guarantee') maxSla = this.sla().bgSlaMaxMinutes;
          
          const elapsed = this.getElapsedMinutes(r);
          if (elapsed > maxSla || r.status === 'Breached' || r.status === 'Breached with Exception') {
              breaches++;
          }
      });
      return Math.round(((total - breaches) / total) * 100);
  }

  private computeSlaPercentage(records: any[], maxSla: number): number {
    const total = records.length;
    if (total === 0) {
      return 0;
    }
    const breached = this.countBreaches(records, maxSla);
    return Math.round(((total - breached) / total) * 100);
  }

  private createComparisonRow(metric: Exclude<SlaComparisonMetric, 'all'>, labelKey: string, current: number, previous: number) {
    const delta = current - previous;
    const trendClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const trendKey = delta > 0 ? 'exec.sla_compare_trend_up' : delta < 0 ? 'exec.sla_compare_trend_down' : 'exec.sla_compare_trend_flat';
    const sign = delta > 0 ? '+' : '';
    return {
      metric,
      labelKey,
      current,
      previous,
      trendClass,
      trendKey,
      deltaText: `${sign}${delta}`,
    };
  }

  comparisonBarWidth(value: number): number {
    return Math.max(0, Math.min(100, value || 0));
  }

  private loadComparisonMetric(): SlaComparisonMetric {
    const stored = localStorage.getItem(this.comparisonMetricStorageKey);
    if (stored === 'overall' || stored === 'import' || stored === 'export' || stored === 'all' || stored === 'bg') {
      return stored;
    }
    return 'overall';
  }

  setComparisonMetric(value: string): void {
    if (value !== 'overall' && value !== 'import' && value !== 'export' && value !== 'all' && value !== 'bg') {
      return;
    }
    this.comparisonMetric.set(value);
    localStorage.setItem(this.comparisonMetricStorageKey, value);
  }

  comparisonRangeSummary(): string {
    const current = this.range();
    const previous = this.dataStore.getPreviousEquivalentRange(current);
    return `${this.ts.translate('exec.sla_compare_current')}: ${this.formatRange(current)} | ${this.ts.translate('exec.sla_compare_previous')}: ${this.formatRange(previous)}`;
  }

  private formatRange(range: DashboardDateRange): string {
    if (range.preset === 'today') return this.ts.translate('date.today');
    if (range.preset === 'yesterday') return this.ts.translate('date.yesterday');
    if (range.preset === 'last7days') return this.ts.translate('date.last_7_days');
    if (range.preset === 'last14days') return this.ts.translate('date.last_14_days');
    if (range.preset === 'last1month') return this.ts.translate('date.last_month');
    if (!range.fromDate || !range.toDate) return this.ts.translate('date.custom');
    return `${range.fromDate} ${this.ts.translate('date.to')} ${range.toDate}`;
  }

  private async refreshSlaComparison(): Promise<void> {
    const currentRange = this.range();
    const previousRange = this.dataStore.getPreviousEquivalentRange(currentRange);
    this.comparisonLoading.set(true);
    try {
      const [currentRecords, previousRecords] = await Promise.all([
        this.dataStore.fetchLCsForRange(currentRange),
        this.dataStore.fetchLCsForRange(previousRange),
      ]);
      this.comparisonCurrentRecords.set(currentRecords);
      this.comparisonPreviousRecords.set(previousRecords);
    } finally {
      this.comparisonLoading.set(false);
    }
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

  showBreachDetails(s: any) {
    if (s.breaches === 0) return;
    this.selectedBreachStats = s;
  }

  showVolumeDetails(s: any): void {
    this.selectedVolumeStats = s;
  }

  async showLcDetails(r: any) {
    this.selectedLc = r;
    this.exceptionHistory = [];
    this.exceptionHistory = await this.dataStore.getLCExceptions(r.id);
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

  formatElapsed(r: any): string {
    const mins = this.getElapsedMinutes(r);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  private mapStagesForComparison(stages: StageDuration[]) {
    const byKey: Record<string, number> = {};
    stages.forEach((stage) => {
      byKey[stage.key] = stage.minutes;
    });
    return {
      inbox: byKey['inbox'] || 0,
      drafting: byKey['drafting'] || 0,
      checking: byKey['checking'] || 0,
      total: (byKey['inbox'] || 0) + (byKey['drafting'] || 0) + (byKey['checking'] || 0) + (byKey['exception'] || 0),
    };
  }

  private topGap(stages: StageDuration[]): number {
    if (stages.length < 2) return 0;
    const sorted = [...stages].sort((a, b) => b.minutes - a.minutes);
    return Math.max(0, sorted[0].minutes - sorted[1].minutes);
  }

  private stageName(labelKey: string): string {
    return this.ts.translate(labelKey);
  }

  ngOnInit(): void {
    this.dataStore.setActiveDashboardContext('executive');
    this.syncInputsFromRange();
    void this.dataStore.refreshData();
    void this.refreshSlaComparison();
  }

  usePreset(preset: 'today' | 'yesterday' | 'last7days' | 'last14days' | 'last1month'): void {
    const bounds = this.presetDateBounds(preset);
    this.customFrom = bounds.from;
    this.customTo = bounds.to;
    void this.dataStore.setPresetDateRange('executive', preset).then(() => this.refreshSlaComparison());
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) return;
    void this.dataStore.setCustomDateRange('executive', this.customFrom, this.customTo).then(() => this.refreshSlaComparison());
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