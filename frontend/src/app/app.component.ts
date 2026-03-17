import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  createAssignee,
  createLCOrder,
  createOfficer,
  getAssignees,
  getData,
  getEventLog,
  getOfficers,
  getSlaConfig,
  initDataStore,
  isBackendOnline,
  refreshData,
  resetAllData,
  saveSlaConfig,
  updateLCStatus,
} from './data.store';
import { applyStaticTranslations, t, toggleLang, updateLangButton } from './lang';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  currentView = 'exec-dashboard';
  currentFilter = 'all';
  timerInterval: number | null = null;
  clockInterval: number | null = null;

  ngOnInit(): void {
    this.exposeGlobals();
    applyStaticTranslations();
    updateLangButton();

    const titleEl = document.getElementById('page-title');
    const crumbEl = document.getElementById('page-breadcrumb');
    if (titleEl) titleEl.textContent = t('page.exec_dashboard.title');
    if (crumbEl) crumbEl.textContent = t('page.exec_dashboard.breadcrumb');

    initDataStore().then(() => {
      this.renderAll();
      if (!isBackendOnline()) {
        this.showToast('info', 'Backend not reachable. Showing cached data.');
      }
      this.updateClock();
      this.startLiveTimers();
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
    }
    if (this.clockInterval) {
      window.clearInterval(this.clockInterval);
    }
  }

  private exposeGlobals(): void {
    const w = window as any;
    w.toggleSidebar = this.toggleSidebar.bind(this);
    w.switchView = this.switchView.bind(this);
    w.toggleLang = this.handleToggleLang.bind(this);
    w.handleReset = this.handleReset.bind(this);
    w.refreshAISummary = this.refreshAISummary.bind(this);
    w.renderQueue = this.renderQueue.bind(this);
    w.setQueueFilter = this.setQueueFilter.bind(this);
    w.renderOfficerReleaseQueue = this.renderOfficerReleaseQueue.bind(this);
    w.handleCreateOrder = this.handleCreateOrder.bind(this);
    w.handleCreateAssignee = this.handleCreateAssignee.bind(this);
    w.handleAddOfficer = this.handleAddOfficer.bind(this);
    w.handleSaveSla = this.handleSaveSla.bind(this);
    w.handleResetSla = this.handleResetSla.bind(this);
    w.clearEventLog = this.clearEventLog.bind(this);
    w.showLcDetails = this.showLcDetails.bind(this);
    w.closeLcDetails = this.closeLcDetails.bind(this);
    w.promptRelease = this.promptRelease.bind(this);
    w.closeReleaseModal = this.closeReleaseModal.bind(this);
    w.submitRelease = this.submitRelease.bind(this);
    w.handleAction = this.handleAction.bind(this);
    w.promptMarkException = this.promptMarkException.bind(this);
    w.promptResolveException = this.promptResolveException.bind(this);
  }

  toggleSidebar(): void {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('active');
  }

  handleToggleLang(): void {
    toggleLang(() => this.switchView(this.currentView));
  }

  switchView(view: string): void {
    this.currentView = view;

    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');

    document.querySelectorAll('.nav-item').forEach((el) => {
      const node = el as HTMLElement;
      node.classList.toggle('active', node.dataset['view'] === view);
    });

    document.querySelectorAll('.view').forEach((el) => {
      const node = el as HTMLElement;
      node.classList.toggle('active', node.id === `view-${view}`);
    });

    const titleKeys: Record<string, string> = {
      'exec-dashboard': 'page.exec_dashboard.title',
      import: 'page.import.title',
      export: 'page.export.title',
      dashboard: 'page.dashboard.title',
      queue: 'page.queue.title',
      'officer-release': 'page.officer_release.title',
      create: 'page.create.title',
      'officer-registration': 'page.officer_registration.title',
      'assignee-master': 'page.assignee_master.title',
      sla: 'page.sla.title',
      eventlog: 'page.eventlog.title',
    };
    const crumbKeys: Record<string, string> = {
      'exec-dashboard': 'page.exec_dashboard.breadcrumb',
      import: 'page.import.breadcrumb',
      export: 'page.export.breadcrumb',
      dashboard: 'page.dashboard.breadcrumb',
      queue: 'page.queue.breadcrumb',
      'officer-release': 'page.officer_release.breadcrumb',
      create: 'page.create.breadcrumb',
      'officer-registration': 'page.officer_registration.breadcrumb',
      'assignee-master': 'page.assignee_master.breadcrumb',
      sla: 'page.sla.breadcrumb',
      eventlog: 'page.eventlog.breadcrumb',
    };

    const titleEl = document.getElementById('page-title');
    const crumbEl = document.getElementById('page-breadcrumb');
    if (titleEl) titleEl.textContent = t(titleKeys[view] || 'page.exec_dashboard.title');
    if (crumbEl) crumbEl.textContent = t(crumbKeys[view] || 'page.exec_dashboard.breadcrumb');

    this.renderAll();
  }

  renderAll(): void {
    applyStaticTranslations();
    this.renderExecDashboard();
    this.renderFilteredView('Import');
    this.renderFilteredView('Export');
    this.renderQueue();
    this.renderOfficerReleaseQueue();
    this.renderAssigneeMaster();
    this.renderOfficerMaster();
    this.renderAssigneeOptions();
    this.renderSlaForm();
    this.renderEventLog();
    this.updateBadges();
    updateLangButton();
  }

  renderFilteredView(type: 'Import' | 'Export'): void {
    const prefix = type.toLowerCase();
    const data = getData().filter((r) => r.transactionType === type);
    const sla = getSlaConfig();

    const active = data.filter((r) => r.status !== 'Released').length;
    const completed = data.filter((r) => r.status === 'Released').length;
    const breaches =
      data.filter((r) => {
        const elapsed = this.getElapsedMinutes(r);
        return elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception';
      }).length + data.filter((r) => r.status === 'Breached').length;

    const releasedItems = data.filter((r) => r.status === 'Released' && r.releasedAt);
    let avgTime = 0;
    if (releasedItems.length > 0) {
      const totalMin = releasedItems.reduce((sum, r) => {
        return sum + Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      }, 0);
      avgTime = Math.round(totalMin / releasedItems.length);
    }

    this.setText(`${prefix}-kpi-active`, String(active));
    this.setText(`${prefix}-kpi-completed`, String(completed));
    this.setText(`${prefix}-kpi-breaches`, String(breaches));
    this.setText(`${prefix}-kpi-avgtime`, `${avgTime}m`);

    this.renderStageChartForData(data, prefix);

    const log = getEventLog().slice(0, 8);
    const tbody = document.getElementById(`${prefix}-recent-activity-body`);
    if (tbody) {
      if (log.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('recent.empty')}</td></tr>`;
      } else {
        tbody.innerHTML = log
          .map(
            (e) => `
            <tr>
              <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">${this.formatTime(e.timestamp)}</td>
              <td><strong>${e.urn}</strong> -> ${e.to} <span style="color:var(--text-muted);font-size:0.75rem">by ${e.user}</span></td>
            </tr>
          `,
          )
          .join('');
      }
    }

    const summaryBody = document.getElementById(`${prefix}-summary-body`);
    if (summaryBody) {
      summaryBody.innerHTML = data
        .slice(0, 15)
        .map(
          (r) => `
        <tr>
          <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
          <td style="font-size:0.8rem;color:var(--text-secondary)">${r.senderEmail}</td>
          <td>${this.statusBadge(r.status)}</td>
          <td style="font-size:0.8rem;color:var(--text-muted)">${this.formatTime(r.receivedAt)}</td>
          <td class="elapsed-time">${this.formatElapsed(r)}</td>
          <td>${this.slaIndicator(r, sla)}</td>
        </tr>
      `,
        )
        .join('');
    }
  }

  renderStageChartForData(data: any[], prefix: string): void {
    const inboxWaits: number[] = [];
    const draftingTimes: number[] = [];
    const checkingTimes: number[] = [];
    const totalTimes: number[] = [];

    data.forEach((r) => {
      if (r.draftingStartedAt) {
        inboxWaits.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      }
      if (r.draftingStartedAt && r.checkingStartedAt) {
        draftingTimes.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
      }
      if (r.checkingStartedAt && r.releasedAt) {
        checkingTimes.push((new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000);
      }
      if (r.releasedAt) {
        totalTimes.push((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      }
    });

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const maxVal = 180;

    this.setBar(`${prefix}-bar-inbox`, avg(inboxWaits), maxVal);
    this.setBar(`${prefix}-bar-drafting`, avg(draftingTimes), maxVal);
    this.setBar(`${prefix}-bar-checking`, avg(checkingTimes), maxVal);
    this.setBar(`${prefix}-bar-total`, avg(totalTimes), maxVal);
  }

  renderExecDashboard(): void {
    const data = getData();
    const sla = getSlaConfig();

    const importData = data.filter((r) => r.transactionType === 'Import');
    const exportData = data.filter((r) => r.transactionType === 'Export');

    const importTotal = importData.length;
    const importBreaches = importData.filter((r) => {
      const elapsed = this.getElapsedMinutes(r);
      return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
    const importSlaCompliant = importTotal > 0 ? Math.round(((importTotal - importBreaches) / importTotal) * 100) : 0;

    const exportTotal = exportData.length;
    const exportBreaches = exportData.filter((r) => {
      const elapsed = this.getElapsedMinutes(r);
      return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
    const exportSlaCompliant = exportTotal > 0 ? Math.round(((exportTotal - exportBreaches) / exportTotal) * 100) : 0;

    const allReleased = data.filter((r) => r.status === 'Released' && r.releasedAt);
    let avgTime = 0;
    if (allReleased.length > 0) {
      const totalMin = allReleased.reduce((sum, r) => {
        return sum + Math.round((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      }, 0);
      avgTime = Math.round(totalMin / allReleased.length);
    }

    this.setText('exec-import-processed', String(importTotal));
    this.setText('exec-export-processed', String(exportTotal));
    this.setText('exec-import-sla', `${importSlaCompliant}%`);
    this.setText('exec-export-sla', `${exportSlaCompliant}%`);
    this.setText('exec-total-breaches', String(importBreaches + exportBreaches));
    this.setText('exec-avg-time', `${avgTime}m`);

    this.renderComparisonChart(importData, exportData);

    const log = getEventLog().slice(0, 8);
    const tbody = document.getElementById('exec-recent-activity-body');
    if (tbody) {
      if (log.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('recent.empty')}</td></tr>`;
      } else {
        tbody.innerHTML = log
          .map(
            (e) => `
            <tr>
              <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">${this.formatTime(e.timestamp)}</td>
              <td><strong>${e.urn}</strong> -> ${e.to} <span style="color:var(--text-muted);font-size:0.75rem">by ${e.user}</span></td>
            </tr>
          `,
          )
          .join('');
      }
    }

    this.renderAISummary(data, sla, importData, exportData, importBreaches, exportBreaches, importSlaCompliant, exportSlaCompliant, avgTime);
  }

  renderComparisonChart(importData: any[], exportData: any[]): void {
    const maxVal = 180;

    const computeStageAvgs = (records: any[]) => {
      const inbox: number[] = [];
      const drafting: number[] = [];
      const checking: number[] = [];
      const total: number[] = [];
      records.forEach((r) => {
        if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
        if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt).getTime() - new Date(r.draftingStartedAt).getTime()) / 60000);
        if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt).getTime() - new Date(r.checkingStartedAt).getTime()) / 60000);
        if (r.releasedAt) total.push((new Date(r.releasedAt).getTime() - new Date(r.receivedAt).getTime()) / 60000);
      });
      const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
      return { inbox: avg(inbox), drafting: avg(drafting), checking: avg(checking), total: avg(total) };
    };

    const imp = computeStageAvgs(importData);
    const exp = computeStageAvgs(exportData);

    this.setBar('exec-bar-inbox-import', imp.inbox, maxVal);
    this.setBar('exec-bar-inbox-export', exp.inbox, maxVal);
    this.setBar('exec-bar-drafting-import', imp.drafting, maxVal);
    this.setBar('exec-bar-drafting-export', exp.drafting, maxVal);
    this.setBar('exec-bar-checking-import', imp.checking, maxVal);
    this.setBar('exec-bar-checking-export', exp.checking, maxVal);
    this.setBar('exec-bar-total-import', imp.total, maxVal);
    this.setBar('exec-bar-total-export', exp.total, maxVal);
  }

  renderAISummary(data: any[], sla: any, importData: any[], exportData: any[], importBreaches: number, exportBreaches: number, importSlaCompliant: number, exportSlaCompliant: number, avgTime: number): void {
    const container = document.getElementById('ai-summary-content');
    if (!container) return;

    const totalActive = data.filter((r) => r.status !== 'Released').length;
    const totalReleased = data.filter((r) => r.status === 'Released').length;
    const totalBreaches = importBreaches + exportBreaches;
    const overallCompliance = data.length > 0 ? Math.round(((data.length - totalBreaches) / data.length) * 100) : 100;

    const slaTarget = `${sla.slaMinMinutes}-${sla.slaMaxMinutes} min`;

    const html = `
        <div class="ai-insight">
            <strong>Overview:</strong> ${totalActive} active L/Cs, ${totalReleased} completed. Avg cycle time: <strong>${avgTime} min</strong> against SLA ${slaTarget}. Overall compliance ${overallCompliance}%.
        </div>
        <div class="ai-insight">
            <strong>Import:</strong> ${importSlaCompliant}% compliant, ${importBreaches} breaches.
        </div>
        <div class="ai-insight">
            <strong>Export:</strong> ${exportSlaCompliant}% compliant, ${exportBreaches} breaches.
        </div>
    `;

    container.innerHTML = html;
  }

  refreshAISummary(): void {
    const container = document.getElementById('ai-summary-content');
    if (container) {
      container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem">${t('exec.ai_generating')}</p>`;
    }
    setTimeout(() => {
      this.renderExecDashboard();
      this.showToast('success', 'AI summary refreshed');
    }, 600);
  }

  setQueueFilter(filter: string): void {
    this.currentFilter = filter;
    document.querySelectorAll('.table-filters .filter-btn').forEach((btn) => {
      const node = btn as HTMLElement;
      node.classList.toggle('active', node.dataset['filter'] === filter);
    });
    this.renderQueue();
  }

  renderQueue(): void {
    const data = getData();
    const sla = getSlaConfig();
    const search = ((document.getElementById('queue-search') as HTMLInputElement | null)?.value || '').toLowerCase();
    const tbody = document.getElementById('queue-body');
    if (!tbody) return;

    let filtered = data;
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === this.currentFilter);
    }
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.urn.toLowerCase().includes(search) ||
          r.senderEmail.toLowerCase().includes(search) ||
          r.subject.toLowerCase().includes(search) ||
          (r.assignedTo || '').toLowerCase().includes(search),
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:2rem">${t('queue.no_records')}</td></tr>`;
    } else {
      tbody.innerHTML = filtered
        .map(
          (r, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
        <td>${this.typeBadge(r.transactionType)}</td>
        <td style="font-size:0.8rem">${r.senderEmail}</td>
        <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.subject}">${r.subject}</td>
        <td style="font-size:0.8rem">${r.assignedTo}</td>
        <td>${this.statusBadge(r.status)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${this.formatTime(r.receivedAt)}</td>
        <td class="elapsed-time">${this.formatElapsed(r)}</td>
        <td>${this.slaIndicator(r, sla)}</td>
        <td>${this.actionButton(r)}</td>
      </tr>
    `,
        )
        .join('');
    }

    this.setText('queue-count', `${t('queue.showing')} ${filtered.length} ${t('queue.of')} ${data.length} ${t('queue.records')}`);
  }

  renderOfficerReleaseQueue(): void {
    const data = getData();
    const search = ((document.getElementById('officer-release-search') as HTMLInputElement | null)?.value || '').toLowerCase();
    const tbody = document.getElementById('officer-release-body');
    const countEl = document.getElementById('officer-release-count');
    if (!tbody || !countEl) return;

    let releasable = data.filter((r) => r.status === 'Checking Underlying' || r.status === 'Breached');

    if (search) {
      releasable = releasable.filter(
        (r) =>
          r.urn.toLowerCase().includes(search) ||
          r.senderEmail.toLowerCase().includes(search) ||
          r.subject.toLowerCase().includes(search) ||
          (r.assignedTo || '').toLowerCase().includes(search),
      );
    }

    if (releasable.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">${t('officer_release.no_records')}</td></tr>`;
    } else {
      tbody.innerHTML = releasable
        .map(
          (r, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
        <td>${this.typeBadge(r.transactionType)}</td>
        <td style="font-size:0.8rem">${r.senderEmail}</td>
        <td style="font-size:0.8rem">${r.assignedTo}</td>
        <td>${this.statusBadge(r.status)}</td>
        <td class="elapsed-time">${this.formatElapsed(r)}</td>
        <td><button class="action-btn success" onclick="promptRelease(${r.id})">${t('action.release')}</button></td>
      </tr>
    `,
        )
        .join('');
    }

    countEl.textContent = `${t('queue.showing')} ${releasable.length} ${t('queue.records')}`;
  }

  updateBadges(): void {
    const data = getData();
    const importActive = data.filter((r) => r.transactionType === 'Import' && r.status !== 'Released').length;
    const exportActive = data.filter((r) => r.transactionType === 'Export' && r.status !== 'Released').length;
    const totalActive = data.filter((r) => r.status !== 'Released').length;

    this.setText('import-badge', String(importActive));
    this.setText('export-badge', String(exportActive));
    this.setText('queue-badge', String(totalActive));
  }

  renderSlaForm(): void {
    const sla = getSlaConfig();
    const minEl = document.getElementById('sla-min') as HTMLInputElement | null;
    const maxEl = document.getElementById('sla-max') as HTMLInputElement | null;
    if (minEl) minEl.value = String(sla.slaMinMinutes);
    if (maxEl) maxEl.value = String(sla.slaMaxMinutes);
  }

  renderAssigneeMaster(): void {
    const body = document.getElementById('assignee-body');
    const countEl = document.getElementById('assignee-count');
    if (!body || !countEl) return;

    const list = getAssignees();
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('assignee.empty')}</td></tr>`;
    } else {
      body.innerHTML = list
        .map(
          (a, i) => `
        <tr>
            <td style="color:var(--text-muted)">${i + 1}</td>
            <td>${a.name}</td>
        </tr>
        `,
        )
        .join('');
    }

    countEl.textContent = `${t('queue.showing')} ${list.length} ${t('queue.records')}`;
  }

  renderOfficerMaster(): void {
    const body = document.getElementById('officer-body');
    const countEl = document.getElementById('officer-count');
    if (!body || !countEl) return;

    const list = getOfficers();
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('officer_registration.empty')}</td></tr>`;
    } else {
      body.innerHTML = list
        .map(
          (a, i) => `
        <tr>
            <td style="color:var(--text-muted)">${i + 1}</td>
            <td>${a.name}</td>
        </tr>
        `,
        )
        .join('');
    }

    countEl.textContent = `${t('queue.showing')} ${list.length} ${t('queue.records')}`;
  }

  renderAssigneeOptions(): void {
    const assigneeList = getAssignees();
    const officerList = getOfficers();
    const assignSelect = document.getElementById('create-assigned');
    const officerSelect = document.getElementById('release-officer');

    if (assignSelect) {
      assignSelect.innerHTML =
        assigneeList.length === 0
          ? `<option value="">${t('assignee.empty')}</option>`
          : assigneeList.map((a) => `<option value="${a.name}">${a.name}</option>`).join('');
    }

    if (officerSelect) {
      officerSelect.innerHTML =
        officerList.length === 0
          ? `<option value="">${t('officer_registration.empty')}</option>`
          : `<option value="">${t('officer_release.select_officer')}</option>` +
            officerList.map((a) => `<option value="${a.name}">${a.name}</option>`).join('');
    }
  }

  async handleSaveSla(): Promise<void> {
    const slaMin = parseInt((document.getElementById('sla-min') as HTMLInputElement).value, 10) || 90;
    const slaMax = parseInt((document.getElementById('sla-max') as HTMLInputElement).value, 10) || 120;
    try {
      await saveSlaConfig({ slaMinMinutes: slaMin, slaMaxMinutes: slaMax });
      this.showToast('success', t('toast.sla_saved'));
      this.renderAll();
    } catch (err: any) {
      this.showToast('info', err.message || 'Failed to save SLA');
    }
  }

  async handleResetSla(): Promise<void> {
    try {
      await saveSlaConfig({ slaMinMinutes: 90, slaMaxMinutes: 120 });
      this.renderSlaForm();
      this.showToast('info', t('toast.sla_reset'));
      this.renderAll();
    } catch (err: any) {
      this.showToast('info', err.message || 'Failed to reset SLA');
    }
  }

  renderEventLog(): void {
    const log = getEventLog();
    const tbody = document.getElementById('eventlog-body');
    if (!tbody) return;

    if (log.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">${t('eventlog.empty')}</td></tr>`;
    } else {
      tbody.innerHTML = log
        .map(
          (e) => `
      <tr>
        <td style="white-space:nowrap;font-size:0.8rem">${this.formatDateTime(e.timestamp)}</td>
        <td><strong>${e.urn}</strong></td>
        <td style="font-size:0.8rem">${e.user}</td>
        <td style="font-size:0.8rem">${e.action}</td>
        <td>${this.statusBadge(e.from)}</td>
        <td>${this.statusBadge(e.to)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${e.notes || '-'}</td>
      </tr>
    `,
        )
        .join('');
    }

    this.setText('eventlog-count', `${log.length} ${t('eventlog.events')}`);
  }

  clearEventLog(): void {
    this.showToast('info', 'Event log clearing from backend is not available yet');
  }

  promptRelease(id: number): void {
    const record = getData().find((r) => r.id === id);
    if (!record) return;
    const idInput = document.getElementById('release-lc-id') as HTMLInputElement | null;
    if (idInput) idInput.value = String(id);
    document.getElementById('release-modal')?.classList.add('active');
  }

  closeReleaseModal(): void {
    document.getElementById('release-modal')?.classList.remove('active');
  }

  async submitRelease(): Promise<void> {
    const idStr = (document.getElementById('release-lc-id') as HTMLInputElement | null)?.value || '';
    const officer = (document.getElementById('release-officer') as HTMLSelectElement | null)?.value || '';
    if (!idStr || !officer) return;

    const id = parseInt(idStr, 10);
    this.closeReleaseModal();
    await this.handleAction(id, 'release', officer);
  }

  promptMarkException(id: number): void {
    const record = getData().find((r) => r.id === id);
    if (!record) return;

    const reason = prompt(t('prompt.mark_exception'), '');
    if (reason === null) return;
    void this.handleAction(id, 'mark-exception', reason);
  }

  promptResolveException(id: number): void {
    const record = getData().find((r) => r.id === id);
    if (!record || !record.exceptionStartedAt) return;

    const autoMins = Math.round((Date.now() - new Date(record.exceptionStartedAt).getTime()) / 60000);
    const userInput = prompt(t('prompt.resolve_exception').replace('{0}', String(autoMins)), String(autoMins));
    if (userInput === null) return;

    const parsedMins = parseInt(userInput, 10);
    const finalMins = Number.isNaN(parsedMins) ? autoMins : parsedMins;
    void this.handleAction(id, 'resolve-exception', finalMins);
  }

  async handleAction(id: number, action: string, payload: any = null): Promise<void> {
    const record = getData().find((r) => r.id === id);
    if (!record) return;

    let newStatus = '';
    let notes = '';
    const requestBody: any = {
      newStatus: '',
      notes: '',
      userId: record.assignedTo || 'system',
    };

    switch (action) {
      case 'start-drafting':
        newStatus = 'Drafting';
        notes = t('note.start_drafting');
        break;
      case 'start-checking':
        newStatus = 'Checking Underlying';
        notes = t('note.start_checking');
        break;
      case 'release':
        newStatus = 'Released';
        notes = t('note.release');
        if (payload) {
          requestBody.approvedBy = payload;
          notes += ` (Approved by: ${payload})`;
        }
        break;
      case 'mark-exception':
        newStatus = 'Exception';
        notes = `${t('note.mark_exception')}${payload ? `: ${payload}` : ''}`;
        requestBody.exceptionReason = payload || '';
        break;
      case 'resolve-exception':
        newStatus = record.previousStatus || 'Drafting';
        notes = t('note.resolve_exception');
        requestBody.exceptionMinutes = payload;
        break;
      default:
        return;
    }

    requestBody.newStatus = newStatus;
    requestBody.notes = notes;

    try {
      await updateLCStatus(id, requestBody);
      this.showToast('success', `${record.urn} -> ${newStatus}`);
      this.renderAll();
    } catch (err: any) {
      this.showToast('info', err.message || 'Failed to update status');
    }
  }

  async handleCreateOrder(event: Event): Promise<void> {
    event.preventDefault();

    const transactionType = (document.getElementById('create-type') as HTMLSelectElement | null)?.value || 'Import';
    const senderEmail = (document.getElementById('create-sender') as HTMLInputElement | null)?.value || '';
    const subject = (document.getElementById('create-subject') as HTMLInputElement | null)?.value || '';
    const assignedTo = (document.getElementById('create-assigned') as HTMLSelectElement | null)?.value || '';

    if (!assignedTo) {
      this.showToast('info', t('assignee.required'));
      return;
    }

    try {
      await createLCOrder({ senderEmail, subject, transactionType, assignedTo });
      (event.target as HTMLFormElement).reset();
      this.showToast('success', t('toast.order_created'));
      this.switchView('queue');
    } catch (err: any) {
      this.showToast('info', err.message || 'Failed to create order');
    }
  }

  async handleCreateAssignee(event: Event): Promise<void> {
    event.preventDefault();
    const nameEl = document.getElementById('assignee-name') as HTMLInputElement | null;
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
      this.showToast('info', t('assignee.required'));
      return;
    }

    try {
      await createAssignee({ name });
      nameEl.value = '';
      this.renderAll();
      this.showToast('success', t('toast.assignee_added'));
    } catch (err: any) {
      this.showToast('info', err.message || t('toast.assignee_add_failed'));
    }
  }

  async handleAddOfficer(event: Event): Promise<void> {
    event.preventDefault();
    const nameEl = document.getElementById('officer-name') as HTMLInputElement | null;
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
      this.showToast('info', t('officer_registration.required'));
      return;
    }

    try {
      await createOfficer({ name });
      nameEl.value = '';
      this.renderAll();
      this.showToast('success', t('toast.officer_added'));
    } catch (err: any) {
      this.showToast('info', err.message || t('toast.officer_add_failed'));
    }
  }

  async handleReset(): Promise<void> {
    if (!confirm(t('toast.confirm_reset'))) return;
    try {
      await resetAllData();
      await refreshData();
      this.renderAll();
      this.showToast('info', t('toast.data_reset'));
    } catch (err: any) {
      this.showToast('info', err.message || 'Reset is not available yet');
    }
  }

  showLcDetails(id: number): void {
    const record = getData().find((r) => r.id === id);
    if (!record) return;

    this.setText('modal-urn-title', record.urn);
    this.setText('modal-subject', `${record.transactionType ? `[${record.transactionType}] ` : ''}${record.subject}`);

    const timelineEl = document.getElementById('modal-timeline');
    if (!timelineEl) return;

    let html = '';
    if (record.receivedAt) {
      html += this.renderTimelineItem(t('timeline.received'), record.receivedAt, 'completed', t('timeline.desc.received'));
    }
    if (record.draftingStartedAt) {
      const statusClass = record.status === 'Drafting' ? 'active' : 'completed';
      html += this.renderTimelineItem(t('timeline.drafting'), record.draftingStartedAt, statusClass, `${t('timeline.desc.drafting')}${record.assignedTo ? ` by ${record.assignedTo}` : ''}`);
    }
    if (record.checkingStartedAt) {
      const isExceptionWhileChecking = record.status === 'Exception' && record.previousStatus === 'Checking Underlying';
      const statusClass = isExceptionWhileChecking ? 'completed' : record.status === 'Checking Underlying' ? 'active' : 'completed';
      html += this.renderTimelineItem(t('timeline.checking'), record.checkingStartedAt, statusClass, t('timeline.desc.checking'));
    }
    if (record.exceptionStartedAt || record.exceptionTotalMinutes > 0) {
      const isActive = record.status === 'Exception';
      const statusClass = isActive ? 'exception active' : 'exception completed';
      const reason = record.exceptionReason || (isActive ? t('timeline.desc.exception_active') : t('timeline.desc.exception_resolved'));
      let desc = reason;
      if (!isActive && record.exceptionTotalMinutes) {
        desc += ` (${record.exceptionTotalMinutes} min total)`;
      }
      html += this.renderTimelineItem(t('timeline.exception'), record.exceptionStartedAt || '', statusClass, desc);
    }
    if (record.releasedAt) {
      html += this.renderTimelineItem(t('timeline.released'), record.releasedAt, 'completed', t('timeline.desc.released'));
    }

    timelineEl.innerHTML = html;
    document.getElementById('lc-modal')?.classList.add('active');
  }

  closeLcDetails(): void {
    document.getElementById('lc-modal')?.classList.remove('active');
  }

  renderTimelineItem(title: string, timeStr: string, stateClass: string, desc: string): string {
    const timeDisplay = timeStr ? this.formatDateTime(timeStr) : '-';
    return `
      <div class="timeline-item ${stateClass}">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <div class="timeline-title">${title}</div>
          <div class="timeline-time">${timeDisplay}</div>
          ${desc ? `<div class="timeline-desc">${desc}</div>` : ''}
        </div>
      </div>
    `;
  }

  statusBadge(status: string): string {
    const cls: Record<string, string> = {
      Received: 'received',
      Drafting: 'drafting',
      'Checking Underlying': 'checking',
      Released: 'released',
      Breached: 'breached',
      Exception: 'exception',
    };
    const badge = cls[status] || 'received';
    return `<span class="status-badge ${badge}"><span class="dot"></span>${status}</span>`;
  }

  typeBadge(type: string): string {
    if (!type) return '';
    const cls = type === 'Import' ? 'import' : 'export';
    return `<span class="type-badge ${cls}">${t(`type.${type.toLowerCase()}`)}</span>`;
  }

  slaIndicator(record: any, sla: any): string {
    if (record.status === 'Released') {
      const total = Math.round((new Date(record.releasedAt).getTime() - new Date(record.receivedAt).getTime()) / 60000);
      if (total <= sla.slaMinMinutes) return `<span class="sla-indicator green">OK ${total}m</span>`;
      if (total <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">WARN ${total}m</span>`;
      return `<span class="sla-indicator red">BREACH ${total}m</span>`;
    }

    const elapsed = this.getElapsedMinutes(record);
    if (elapsed <= sla.slaMinMinutes) return `<span class="sla-indicator green">${t('sla.ok')}</span>`;
    if (elapsed <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">${t('sla.warning')}</span>`;
    return `<span class="sla-indicator red">${t('sla.breach')}</span>`;
  }

  actionButton(record: any): string {
    switch (record.status) {
      case 'Received':
        return `<button class="action-btn primary" onclick="handleAction(${record.id}, 'start-drafting')">${t('action.start_drafting')}</button>
                    <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary);margin-top:4px" onclick="promptMarkException(${record.id})">${t('action.mark_exception')}</button>`;
      case 'Drafting':
        return `<button class="action-btn warning" onclick="handleAction(${record.id}, 'start-checking')">${t('action.start_checking')}</button>
                    <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary);margin-top:4px" onclick="promptMarkException(${record.id})">${t('action.mark_exception')}</button>`;
      case 'Checking Underlying':
        return `<button class="action-btn success" onclick="promptRelease(${record.id})">${t('action.release')}</button>
                    <button class="action-btn" style="background:var(--bg-secondary);color:var(--text-secondary);margin-top:4px" onclick="promptMarkException(${record.id})">${t('action.mark_exception')}</button>`;
      case 'Released':
        return `<span class="action-btn completed">${t('action.completed')}</span>`;
      case 'Breached':
        return `<button class="action-btn primary" onclick="handleAction(${record.id}, 'start-drafting')">${t('action.resume')}</button>`;
      case 'Exception':
        return `<button class="action-btn dark" onclick="promptResolveException(${record.id})">${t('action.resolve_exception')}</button>`;
      default:
        return '';
    }
  }

  getElapsedMinutes(record: any): number {
    let totalElapsedMins = 0;
    if (record.status === 'Released' && record.releasedAt) {
      totalElapsedMins = Math.round((new Date(record.releasedAt).getTime() - new Date(record.receivedAt).getTime()) / 60000);
    } else if (record.status === 'Exception' && record.exceptionStartedAt) {
      totalElapsedMins = Math.round((new Date(record.exceptionStartedAt).getTime() - new Date(record.receivedAt).getTime()) / 60000);
    } else {
      totalElapsedMins = Math.round((Date.now() - new Date(record.receivedAt).getTime()) / 60000);
    }

    const pausedTime = record.exceptionTotalMinutes || 0;
    return Math.max(0, totalElapsedMins - pausedTime);
  }

  formatElapsed(record: any): string {
    const mins = this.getElapsedMinutes(record);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  formatTime(isoStr: string): string {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateTime(isoStr: string): string {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  setBar(id: string, value: number, maxVal: number): void {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) return;
    const pct = Math.min(100, Math.max(5, (Math.abs(value) / maxVal) * 100));
    el.style.width = `${pct}%`;
    el.textContent = `${Math.abs(Math.round(value))} min`;
  }

  showToast(type: 'success' | 'info', message: string): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? 'OK' : 'i'}</div>
    <span>${message}</span>
  `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  updateClock(): void {
    const el = document.getElementById('clock');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  }

  startLiveTimers(): void {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
    }

    this.timerInterval = window.setInterval(() => {
      void refreshData().catch(() => {});
      if (this.currentView === 'exec-dashboard') this.renderExecDashboard();
      if (this.currentView === 'import' || this.currentView === 'export') this.renderFilteredView(this.currentView === 'import' ? 'Import' : 'Export');
      if (this.currentView === 'queue') this.renderQueue();
      if (this.currentView === 'officer-release') this.renderOfficerReleaseQueue();
      this.updateClock();
    }, 30000);

    this.clockInterval = window.setInterval(() => this.updateClock(), 1000);
  }

  private setText(id: string, value: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }
}
