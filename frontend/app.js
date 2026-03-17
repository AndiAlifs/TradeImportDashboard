// ============================================================
// Shila Dashboard — app.js
// Interactive logic: navigation, rendering, state transitions
// ============================================================

// --------------- State ---------------
let currentView = 'exec-dashboard';
let currentFilter = 'all';
let timerInterval = null;

// --------------- Sidebar Toggle (mobile) ---------------
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

// --------------- Navigation ---------------
function switchView(view) {
    currentView = view;

    // Close sidebar on mobile after navigation
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');

    // Toggle active nav
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });

    // Toggle views
    document.querySelectorAll('.view').forEach(el => {
        el.classList.toggle('active', el.id === `view-${view}`);
    });

    // Update top bar (translated)
    const titleKeys = {
        'exec-dashboard': 'page.exec_dashboard.title',
        'import': 'page.import.title',
        'export': 'page.export.title',
        dashboard: 'page.dashboard.title',
        queue: 'page.queue.title',
        'officer-release': 'page.officer_release.title',
        create: 'page.create.title',
        'officer-registration': 'page.officer_registration.title',
        'assignee-master': 'page.assignee_master.title',
        sla: 'page.sla.title',
        eventlog: 'page.eventlog.title',
    };
    const crumbKeys = {
        'exec-dashboard': 'page.exec_dashboard.breadcrumb',
        'import': 'page.import.breadcrumb',
        'export': 'page.export.breadcrumb',
        dashboard: 'page.dashboard.breadcrumb',
        queue: 'page.queue.breadcrumb',
        'officer-release': 'page.officer_release.breadcrumb',
        create: 'page.create.breadcrumb',
        'officer-registration': 'page.officer_registration.breadcrumb',
        'assignee-master': 'page.assignee_master.breadcrumb',
        sla: 'page.sla.breadcrumb',
        eventlog: 'page.eventlog.breadcrumb',
    };
    document.getElementById('page-title').textContent = t(titleKeys[view] || 'page.exec_dashboard.title');
    document.getElementById('page-breadcrumb').textContent = t(crumbKeys[view] || 'page.exec_dashboard.breadcrumb');

    // Render the active view
    renderAll();
}

// --------------- Rendering ---------------
function renderAll() {
    applyStaticTranslations();
    renderExecDashboard();
    renderFilteredView('Import');
    renderFilteredView('Export');
    renderQueue();
    renderOfficerReleaseQueue();
    renderAssigneeMaster();
    renderOfficerMaster();
    renderAssigneeOptions();
    renderSlaForm();
    renderEventLog();
    updateBadges();
    updateLangButton();
}

// --------------- Filtered View Rendering (Import / Export) ---------------
function renderFilteredView(type) {
    const prefix = type.toLowerCase();
    const data = getData().filter(r => r.transactionType === type);
    const sla = getSlaConfig();

    // KPIs
    const active = data.filter(r => r.status !== 'Released').length;
    const completed = data.filter(r => r.status === 'Released').length;
    const breaches = data.filter(r => {
        const elapsed = getElapsedMinutes(r);
        return elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception';
    }).length + data.filter(r => r.status === 'Breached').length;

    const releasedItems = data.filter(r => r.status === 'Released' && r.releasedAt);
    let avgTime = 0;
    if (releasedItems.length > 0) {
        const totalMin = releasedItems.reduce((sum, r) => {
            return sum + Math.round((new Date(r.releasedAt) - new Date(r.receivedAt)) / 60000);
        }, 0);
        avgTime = Math.round(totalMin / releasedItems.length);
    }

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl(`${prefix}-kpi-active`, active);
    setEl(`${prefix}-kpi-completed`, completed);
    setEl(`${prefix}-kpi-breaches`, breaches);
    setEl(`${prefix}-kpi-avgtime`, avgTime + 'm');

    // Stage chart
    renderStageChartForData(data, prefix);

    // Recent Activity (show all-type events from the log)
    const log = getEventLog().slice(0, 8);
    const tbody = document.getElementById(`${prefix}-recent-activity-body`);
    if (tbody) {
        if (log.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('recent.empty')}</td></tr>`;
        } else {
            tbody.innerHTML = log.map(e => `
            <tr>
              <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">${formatTime(e.timestamp)}</td>
              <td><strong>${e.urn}</strong> → ${e.to} <span style="color:var(--text-muted);font-size:0.75rem">by ${e.user}</span></td>
            </tr>
          `).join('');
        }
    }

    // Summary table
    const summaryBody = document.getElementById(`${prefix}-summary-body`);
    if (summaryBody) {
        summaryBody.innerHTML = data.slice(0, 15).map(r => `
        <tr>
          <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
          <td style="font-size:0.8rem;color:var(--text-secondary)">${r.senderEmail}</td>
          <td>${statusBadge(r.status)}</td>
          <td style="font-size:0.8rem;color:var(--text-muted)">${formatTime(r.receivedAt)}</td>
          <td class="elapsed-time">${formatElapsed(r)}</td>
          <td>${slaIndicator(r, sla)}</td>
        </tr>
      `).join('');
    }
}

function renderStageChartForData(data, prefix) {
    let inboxWaits = [], draftingTimes = [], checkingTimes = [], totalTimes = [];

    data.forEach(r => {
        if (r.draftingStartedAt) {
            inboxWaits.push((new Date(r.draftingStartedAt) - new Date(r.receivedAt)) / 60000);
        }
        if (r.draftingStartedAt && r.checkingStartedAt) {
            draftingTimes.push((new Date(r.checkingStartedAt) - new Date(r.draftingStartedAt)) / 60000);
        }
        if (r.checkingStartedAt && r.releasedAt) {
            checkingTimes.push((new Date(r.releasedAt) - new Date(r.checkingStartedAt)) / 60000);
        }
        if (r.releasedAt) {
            totalTimes.push((new Date(r.releasedAt) - new Date(r.receivedAt)) / 60000);
        }
    });

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const maxVal = 180;

    setBar(`${prefix}-bar-inbox`, avg(inboxWaits), maxVal);
    setBar(`${prefix}-bar-drafting`, avg(draftingTimes), maxVal);
    setBar(`${prefix}-bar-checking`, avg(checkingTimes), maxVal);
    setBar(`${prefix}-bar-total`, avg(totalTimes), maxVal);
}

// --------------- Executive Dashboard ---------------
function renderExecDashboard() {
    const data = getData();
    const sla = getSlaConfig();

    const importData = data.filter(r => r.transactionType === 'Import');
    const exportData = data.filter(r => r.transactionType === 'Export');

    // Import metrics
    const importTotal = importData.length;
    const importReleased = importData.filter(r => r.status === 'Released');
    const importBreaches = importData.filter(r => {
        const elapsed = getElapsedMinutes(r);
        return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
    const importSlaCompliant = importTotal > 0
        ? Math.round(((importTotal - importBreaches) / importTotal) * 100)
        : 0;

    // Export metrics
    const exportTotal = exportData.length;
    const exportBreaches = exportData.filter(r => {
        const elapsed = getElapsedMinutes(r);
        return (elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception') || r.status === 'Breached';
    }).length;
    const exportSlaCompliant = exportTotal > 0
        ? Math.round(((exportTotal - exportBreaches) / exportTotal) * 100)
        : 0;

    // Combined avg time
    const allReleased = data.filter(r => r.status === 'Released' && r.releasedAt);
    let avgTime = 0;
    if (allReleased.length > 0) {
        const totalMin = allReleased.reduce((sum, r) => {
            return sum + Math.round((new Date(r.releasedAt) - new Date(r.receivedAt)) / 60000);
        }, 0);
        avgTime = Math.round(totalMin / allReleased.length);
    }

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('exec-import-processed', importTotal);
    setEl('exec-export-processed', exportTotal);
    setEl('exec-import-sla', importSlaCompliant + '%');
    setEl('exec-export-sla', exportSlaCompliant + '%');
    setEl('exec-total-breaches', importBreaches + exportBreaches);
    setEl('exec-avg-time', avgTime + 'm');

    // Comparison chart
    renderComparisonChart(importData, exportData);

    // Recent activity for exec
    const log = getEventLog().slice(0, 8);
    const tbody = document.getElementById('exec-recent-activity-body');
    if (tbody) {
        if (log.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('recent.empty')}</td></tr>`;
        } else {
            tbody.innerHTML = log.map(e => `
            <tr>
              <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">${formatTime(e.timestamp)}</td>
              <td><strong>${e.urn}</strong> → ${e.to} <span style="color:var(--text-muted);font-size:0.75rem">by ${e.user}</span></td>
            </tr>
          `).join('');
        }
    }

    // AI Summary
    renderAISummary(data, sla, importData, exportData, importBreaches, exportBreaches, importSlaCompliant, exportSlaCompliant, avgTime);
}

function renderComparisonChart(importData, exportData) {
    const maxVal = 180;

    function computeStageAvgs(records) {
        let inbox = [], drafting = [], checking = [], total = [];
        records.forEach(r => {
            if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt) - new Date(r.receivedAt)) / 60000);
            if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt) - new Date(r.draftingStartedAt)) / 60000);
            if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt) - new Date(r.checkingStartedAt)) / 60000);
            if (r.releasedAt) total.push((new Date(r.releasedAt) - new Date(r.receivedAt)) / 60000);
        });
        const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        return { inbox: avg(inbox), drafting: avg(drafting), checking: avg(checking), total: avg(total) };
    }

    const imp = computeStageAvgs(importData);
    const exp = computeStageAvgs(exportData);

    setBar('exec-bar-inbox-import', imp.inbox, maxVal);
    setBar('exec-bar-inbox-export', exp.inbox, maxVal);
    setBar('exec-bar-drafting-import', imp.drafting, maxVal);
    setBar('exec-bar-drafting-export', exp.drafting, maxVal);
    setBar('exec-bar-checking-import', imp.checking, maxVal);
    setBar('exec-bar-checking-export', exp.checking, maxVal);
    setBar('exec-bar-total-import', imp.total, maxVal);
    setBar('exec-bar-total-export', exp.total, maxVal);
}

// --------------- AI Summary ---------------
function renderAISummary(data, sla, importData, exportData, importBreaches, exportBreaches, importSlaCompliant, exportSlaCompliant, avgTime) {
    const container = document.getElementById('ai-summary-content');
    if (!container) return;

    const totalActive = data.filter(r => r.status !== 'Released').length;
    const totalReleased = data.filter(r => r.status === 'Released').length;
    const totalBreaches = importBreaches + exportBreaches;

    // Find bottleneck stage
    function findBottleneck(records) {
        let inbox = [], drafting = [], checking = [];
        records.forEach(r => {
            if (r.draftingStartedAt) inbox.push((new Date(r.draftingStartedAt) - new Date(r.receivedAt)) / 60000);
            if (r.draftingStartedAt && r.checkingStartedAt) drafting.push((new Date(r.checkingStartedAt) - new Date(r.draftingStartedAt)) / 60000);
            if (r.checkingStartedAt && r.releasedAt) checking.push((new Date(r.releasedAt) - new Date(r.checkingStartedAt)) / 60000);
        });
        const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const stages = [
            { name: 'Inbox Wait', avg: avg(inbox) },
            { name: 'Drafting', avg: avg(drafting) },
            { name: 'Checking Underlying', avg: avg(checking) },
        ];
        return stages.sort((a, b) => b.avg - a.avg)[0];
    }

    const importBottleneck = findBottleneck(importData);
    const exportBottleneck = findBottleneck(exportData);

    // Compare volumes
    const impVol = importData.length;
    const expVol = exportData.length;
    let volumeInsight = '';
    if (impVol > expVol * 1.3) {
        volumeInsight = `Import volume is significantly higher (${impVol} vs ${expVol}). Consider monitoring Import workload distribution.`;
    } else if (expVol > impVol * 1.3) {
        volumeInsight = `Export volume is significantly higher (${expVol} vs ${impVol}). Consider monitoring Export workload distribution.`;
    } else {
        volumeInsight = `Processing volumes are balanced — Import: ${impVol}, Export: ${expVol}.`;
    }

    // Determine overall health
    const overallCompliance = data.length > 0 ? Math.round(((data.length - totalBreaches) / data.length) * 100) : 100;
    let healthStatus = '';
    let healthClass = '';
    if (overallCompliance >= 90) {
        healthStatus = '🟢 Excellent';
        healthClass = 'health-good';
    } else if (overallCompliance >= 75) {
        healthStatus = '🟡 Moderate';
        healthClass = 'health-moderate';
    } else {
        healthStatus = '🔴 Critical';
        healthClass = 'health-critical';
    }

    const slaTarget = `${sla.slaMinMinutes}–${sla.slaMaxMinutes} min`;

    let html = `
        <div class="ai-insight">
            <div class="ai-health ${healthClass}">
                <span class="health-label">Overall Health:</span>
                <span class="health-value">${healthStatus}</span>
                <span class="health-detail">(${overallCompliance}% SLA compliance)</span>
            </div>
        </div>
        <div class="ai-insight">
            <strong>📊 Overview:</strong> ${totalActive} active L/Cs, ${totalReleased} completed today. Average cycle time: <strong>${avgTime} min</strong> against SLA target of ${slaTarget}.
        </div>
        <div class="ai-insight">
            <strong>📦 Import Performance:</strong> SLA compliance at <strong>${importSlaCompliant}%</strong> with ${importBreaches} breach${importBreaches !== 1 ? 'es' : ''}. ${importBottleneck.avg > 0 ? `Primary bottleneck: <em>${importBottleneck.name}</em> (avg ${importBottleneck.avg} min).` : 'Insufficient data for bottleneck analysis.'}
        </div>
        <div class="ai-insight">
            <strong>🚢 Export Performance:</strong> SLA compliance at <strong>${exportSlaCompliant}%</strong> with ${exportBreaches} breach${exportBreaches !== 1 ? 'es' : ''}. ${exportBottleneck.avg > 0 ? `Primary bottleneck: <em>${exportBottleneck.name}</em> (avg ${exportBottleneck.avg} min).` : 'Insufficient data for bottleneck analysis.'}
        </div>
        <div class="ai-insight">
            <strong>💡 Recommendation:</strong> ${volumeInsight}${totalBreaches > 0 ? ` Focus on reducing ${importBreaches >= exportBreaches ? 'Import' : 'Export'} ${importBreaches >= exportBreaches ? importBottleneck.name : exportBottleneck.name} times to improve overall SLA compliance.` : ' All operations within target — maintain current performance.'}
        </div>
    `;

    container.innerHTML = html;
}

function refreshAISummary() {
    const container = document.getElementById('ai-summary-content');
    if (container) {
        container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem">${t('exec.ai_generating')}</p>`;
    }
    // Simulate brief delay then re-render
    setTimeout(() => {
        renderExecDashboard();
        showToast('success', 'AI summary refreshed');
    }, 600);
}

// --------------- Queue ---------------
function setQueueFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.table-filters .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderQueue();
}

function renderQueue() {
    const data = getData();
    const sla = getSlaConfig();
    const search = (document.getElementById('queue-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('queue-body');
    if (!tbody) return;

    let filtered = data;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }
    if (search) {
        filtered = filtered.filter(r =>
            r.urn.toLowerCase().includes(search) ||
            r.senderEmail.toLowerCase().includes(search) ||
            r.subject.toLowerCase().includes(search) ||
            (r.assignedTo || '').toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:2rem">${t('queue.no_records')}</td></tr>`;
    } else {
        tbody.innerHTML = filtered.map((r, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
        <td>${typeBadge(r.transactionType)}</td>
        <td style="font-size:0.8rem">${r.senderEmail}</td>
        <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.subject}">${r.subject}</td>
        <td style="font-size:0.8rem">${r.assignedTo}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">${formatTime(r.receivedAt)}</td>
        <td class="elapsed-time">${formatElapsed(r)}</td>
        <td>${slaIndicator(r, sla)}</td>
        <td>${actionButton(r)}</td>
      </tr>
    `).join('');
    }

    document.getElementById('queue-count').textContent = `${t('queue.showing')} ${filtered.length} ${t('queue.of')} ${data.length} ${t('queue.records')}`;
}

function renderOfficerReleaseQueue() {
    const data = getData();
    const search = (document.getElementById('officer-release-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('officer-release-body');
    const countEl = document.getElementById('officer-release-count');
    if (!tbody || !countEl) return;

    let releasable = data.filter(r => r.status === 'Checking Underlying' || r.status === 'Breached');

    if (search) {
        releasable = releasable.filter(r =>
            r.urn.toLowerCase().includes(search) ||
            r.senderEmail.toLowerCase().includes(search) ||
            r.subject.toLowerCase().includes(search) ||
            (r.assignedTo || '').toLowerCase().includes(search)
        );
    }

    if (releasable.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">${t('officer_release.no_records')}</td></tr>`;
    } else {
        tbody.innerHTML = releasable.map((r, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
        <td>${typeBadge(r.transactionType)}</td>
        <td style="font-size:0.8rem">${r.senderEmail}</td>
        <td style="font-size:0.8rem">${r.assignedTo}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="elapsed-time">${formatElapsed(r)}</td>
        <td><button class="action-btn success" onclick="promptRelease(${r.id})">${t('action.release')}</button></td>
      </tr>
    `).join('');
    }

    countEl.textContent = `${t('queue.showing')} ${releasable.length} ${t('queue.records')}`;
}

function updateBadges() {
    const data = getData();
    const importActive = data.filter(r => r.transactionType === 'Import' && r.status !== 'Released').length;
    const exportActive = data.filter(r => r.transactionType === 'Export' && r.status !== 'Released').length;
    const totalActive = data.filter(r => r.status !== 'Released').length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('import-badge', importActive);
    setEl('export-badge', exportActive);
    setEl('queue-badge', totalActive);
}

// --------------- SLA ---------------
function renderSlaForm() {
    const sla = getSlaConfig();
    const minEl = document.getElementById('sla-min');
    const maxEl = document.getElementById('sla-max');
    if (minEl) minEl.value = sla.slaMinMinutes;
    if (maxEl) maxEl.value = sla.slaMaxMinutes;
}

function renderAssigneeMaster() {
    const body = document.getElementById('assignee-body');
    const countEl = document.getElementById('assignee-count');
    if (!body || !countEl) return;

    const list = getAssignees();
    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('assignee.empty')}</td></tr>`;
    } else {
        body.innerHTML = list.map((a, i) => `
        <tr>
            <td style="color:var(--text-muted)">${i + 1}</td>
            <td>${a.name}</td>
        </tr>
        `).join('');
    }

    countEl.textContent = `${t('queue.showing')} ${list.length} ${t('queue.records')}`;
}

function renderOfficerMaster() {
    const body = document.getElementById('officer-body');
    const countEl = document.getElementById('officer-count');
    if (!body || !countEl) return;

    const list = getOfficers();
    if (list.length === 0) {
        body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('officer_registration.empty')}</td></tr>`;
    } else {
        body.innerHTML = list.map((a, i) => `
        <tr>
            <td style="color:var(--text-muted)">${i + 1}</td>
            <td>${a.name}</td>
        </tr>
        `).join('');
    }

    countEl.textContent = `${t('queue.showing')} ${list.length} ${t('queue.records')}`;
}

function renderAssigneeOptions() {
    const assigneeList = getAssignees();
    const officerList = getOfficers();
    const assignSelect = document.getElementById('create-assigned');
    const officerSelect = document.getElementById('release-officer');

    if (assignSelect) {
        assignSelect.innerHTML = assigneeList.length === 0
            ? `<option value="">${t('assignee.empty')}</option>`
            : assigneeList.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    }

    if (officerSelect) {
        officerSelect.innerHTML = officerList.length === 0
            ? `<option value="">${t('officer_registration.empty')}</option>`
            : `<option value="">${t('officer_release.select_officer')}</option>` +
              officerList.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    }
}

async function handleSaveSla() {
    const slaMin = parseInt(document.getElementById('sla-min').value) || 90;
    const slaMax = parseInt(document.getElementById('sla-max').value) || 120;
    try {
        await saveSlaConfig({ slaMinMinutes: slaMin, slaMaxMinutes: slaMax });
        showToast('success', t('toast.sla_saved'));
        renderAll();
    } catch (err) {
        showToast('info', err.message || 'Failed to save SLA');
    }
}

async function handleResetSla() {
    try {
        await saveSlaConfig({ slaMinMinutes: 90, slaMaxMinutes: 120 });
        renderSlaForm();
        showToast('info', t('toast.sla_reset'));
        renderAll();
    } catch (err) {
        showToast('info', err.message || 'Failed to reset SLA');
    }
}

// --------------- Event Log ---------------
function renderEventLog() {
    const log = getEventLog();
    const tbody = document.getElementById('eventlog-body');
    if (!tbody) return;

    if (log.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">${t('eventlog.empty')}</td></tr>`;
    } else {
        tbody.innerHTML = log.map(e => `
      <tr>
        <td style="white-space:nowrap;font-size:0.8rem">${formatDateTime(e.timestamp)}</td>
        <td><strong>${e.urn}</strong></td>
        <td style="font-size:0.8rem">${e.user}</td>
        <td style="font-size:0.8rem">${e.action}</td>
        <td>${statusBadge(e.from)}</td>
        <td>${statusBadge(e.to)}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${e.notes || '—'}</td>
      </tr>
    `).join('');
    }

    document.getElementById('eventlog-count').textContent = `${log.length} ${t('eventlog.events')}`;
}

function clearEventLog() {
    showToast('info', 'Event log clearing from backend is not available yet');
}

// --------------- Actions ---------------
function promptRelease(id) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;
    
    document.getElementById('release-lc-id').value = id;
    document.getElementById('release-modal').classList.add('active');
}

function closeReleaseModal() {
    document.getElementById('release-modal').classList.remove('active');
}

async function submitRelease() {
    const idStr = document.getElementById('release-lc-id').value;
    const officer = document.getElementById('release-officer').value;
    if (!idStr || !officer) return;
    
    const id = parseInt(idStr, 10);
    closeReleaseModal();
    await handleAction(id, 'release', officer);
}

function promptMarkException(id) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;

    const promptMsg = t('prompt.mark_exception');
    const reason = prompt(promptMsg, "");
    
    if (reason === null) return; // User cancelled
    
    handleAction(id, 'mark-exception', reason);
}

function promptResolveException(id) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record || !record.exceptionStartedAt) return;

    const autoMins = Math.round((Date.now() - new Date(record.exceptionStartedAt)) / 60000);
    const promptMsg = t('prompt.resolve_exception').replace('{0}', autoMins);
    
    const userInput = prompt(promptMsg, autoMins);
    if (userInput === null) return; // User cancelled
    
    const parsedMins = parseInt(userInput, 10);
    const finalMins = isNaN(parsedMins) ? autoMins : parsedMins;

    handleAction(id, 'resolve-exception', finalMins);
}

async function handleAction(id, action, payload = null) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;

    const prevStatus = record.status;
    let newStatus = '';
    let notes = '';
    const requestBody = {
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
            notes = t('note.mark_exception') + (payload ? `: ${payload}` : '');
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
        showToast('success', `${record.urn} -> ${newStatus}`);
        renderAll();
    } catch (err) {
        showToast('info', err.message || `Failed to update status from ${prevStatus}`);
    }
}

async function handleCreateOrder(event) {
    event.preventDefault(); // Prevent default form submission

    // Get input values
    const transactionType = document.getElementById('create-type').value;
    const senderEmail = document.getElementById('create-sender').value;
    const subject = document.getElementById('create-subject').value;
    const assignedTo = document.getElementById('create-assigned').value;

    if (!assignedTo) {
        showToast('info', t('assignee.required'));
        return;
    }

    try {
        await createLCOrder({
            senderEmail,
            subject,
            transactionType,
            assignedTo,
        });

        // Reset form
        event.target.reset();

        // Show success toast and redirect
        showToast('success', t('toast.order_created'));
        switchView('queue');
    } catch (err) {
        showToast('info', err.message || 'Failed to create order');
    }
}

async function handleCreateAssignee(event) {
    event.preventDefault();
    const nameEl = document.getElementById('assignee-name');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
        showToast('info', t('assignee.required'));
        return;
    }

    try {
        await createAssignee({ name });
        nameEl.value = '';
        renderAll();
        showToast('success', t('toast.assignee_added'));
    } catch (err) {
        showToast('info', err.message || t('toast.assignee_add_failed'));
    }
}

async function handleAddOfficer(event) {
    event.preventDefault();
    const nameEl = document.getElementById('officer-name');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
        showToast('info', t('officer_registration.required'));
        return;
    }

    try {
        await createOfficer({ name });
        nameEl.value = '';
        renderAll();
        showToast('success', t('toast.officer_added'));
    } catch (err) {
        showToast('info', err.message || t('toast.officer_add_failed'));
    }
}

async function handleReset() {
    if (!confirm(t('toast.confirm_reset'))) return;
    try {
        await resetAllData();
        await refreshData();
        renderAll();
        showToast('info', t('toast.data_reset'));
    } catch (err) {
        showToast('info', err.message || 'Reset is not available yet');
    }
}

// --------------- HTML Builders ---------------
function showLcDetails(id) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;

    document.getElementById('modal-urn-title').textContent = record.urn;
    document.getElementById('modal-subject').textContent = `${record.transactionType ? `[${record.transactionType}] ` : ''}${record.subject}`;
    
    const timelineEl = document.getElementById('modal-timeline');
    
    let html = '';
    
    // 1. Received
    if (record.receivedAt) {
        html += renderTimelineItem(t('timeline.received'), record.receivedAt, 'completed', t('timeline.desc.received'));
    }
    
    // 2. Drafting
    if (record.draftingStartedAt) {
        const statusClass = record.status === 'Drafting' ? 'active' : 'completed';
        html += renderTimelineItem(t('timeline.drafting'), record.draftingStartedAt, statusClass, t('timeline.desc.drafting') + (record.assignedTo ? ` by ${record.assignedTo}` : ''));
    }
    
    // 3. Checking
    if (record.checkingStartedAt) {
        const isExceptionWhileChecking = record.status === 'Exception' && record.previousStatus === 'Checking Underlying';
        const statusClass = isExceptionWhileChecking ? 'completed' : (record.status === 'Checking Underlying' ? 'active' : 'completed');
        html += renderTimelineItem(t('timeline.checking'), record.checkingStartedAt, statusClass, t('timeline.desc.checking'));
    }
    
    // 4. Exception (if any)
    if (record.exceptionStartedAt || record.exceptionTotalMinutes > 0) {
        const isActive = record.status === 'Exception';
        const timeToUse = record.exceptionStartedAt || ''; 
        const statusClass = isActive ? 'exception active' : 'exception completed';
        const reason = record.exceptionReason ? record.exceptionReason : (isActive ? t('timeline.desc.exception_active') : t('timeline.desc.exception_resolved'));
        
        let desc = reason;
        if (!isActive && record.exceptionTotalMinutes) {
            desc += ` (${record.exceptionTotalMinutes} min total)`;
        }
        
        html += renderTimelineItem(t('timeline.exception'), timeToUse, statusClass, desc);
    }
    
    // 5. Released
    if (record.releasedAt) {
        html += renderTimelineItem(t('timeline.released'), record.releasedAt, 'completed', t('timeline.desc.released'));
    }

    timelineEl.innerHTML = html;
    
    document.getElementById('lc-modal').classList.add('active');
}

function closeLcDetails() {
    document.getElementById('lc-modal').classList.remove('active');
}

function renderTimelineItem(title, timeStr, stateClass, desc) {
    const timeDisplay = timeStr ? formatDateTime(timeStr) : '—';
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

function statusBadge(status) {
    const cls = {
        'Received': 'received',
        'Drafting': 'drafting',
        'Checking Underlying': 'checking',
        'Released': 'released',
        'Breached': 'breached',
        'Exception': 'exception',
    }[status] || 'received';

    return `<span class="status-badge ${cls}"><span class="dot"></span>${status}</span>`;
}

function typeBadge(type) {
    if (!type) return '';
    const cls = type === 'Import' ? 'import' : 'export';
    return `<span class="type-badge ${cls}">${t('type.' + type.toLowerCase())}</span>`;
}

function slaIndicator(record, sla) {
    if (record.status === 'Released') {
        const total = Math.round((new Date(record.releasedAt) - new Date(record.receivedAt)) / 60000);
        if (total <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${total}m</span>`;
        if (total <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${total}m</span>`;
        return `<span class="sla-indicator red">✗ ${total}m</span>`;
    }

    const elapsed = getElapsedMinutes(record);
    if (elapsed <= sla.slaMinMinutes) return `<span class="sla-indicator green">✓ ${t('sla.ok')}</span>`;
    if (elapsed <= sla.slaMaxMinutes) return `<span class="sla-indicator yellow">⚠ ${t('sla.warning')}</span>`;
    return `<span class="sla-indicator red">✗ ${t('sla.breach')}</span>`;
}

function actionButton(record) {
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

// --------------- Utilities ---------------
function getElapsedMinutes(record) {
    let totalElapsedMins = 0;

    if (record.status === 'Released' && record.releasedAt) {
        totalElapsedMins = Math.round((new Date(record.releasedAt) - new Date(record.receivedAt)) / 60000);
    } else if (record.status === 'Exception' && record.exceptionStartedAt) {
        // Stop counting logic: pretend current time is when the exception started
        totalElapsedMins = Math.round((new Date(record.exceptionStartedAt) - new Date(record.receivedAt)) / 60000);
    } else {
        totalElapsedMins = Math.round((Date.now() - new Date(record.receivedAt)) / 60000);
    }

    // Subtract accumulated paused time from past exceptions
    const pausedTime = record.exceptionTotalMinutes || 0;
    return Math.max(0, totalElapsedMins - pausedTime);
}

function formatElapsed(record) {
    const mins = getElapsedMinutes(record);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

function formatTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function setBar(id, value, maxVal) {
    const el = document.getElementById(id);
    if (!el) return;
    const pct = Math.min(100, Math.max(5, (Math.abs(value) / maxVal) * 100));
    el.style.width = pct + '%';
    el.textContent = Math.abs(Math.round(value)) + ' min';
}

// --------------- Toast ---------------
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '✓' : 'ℹ'}</div>
    <span>${message}</span>
  `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --------------- Clock ---------------
function updateClock() {
    const el = document.getElementById('clock');
    if (el) {
        el.textContent = new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }
}

// --------------- Live Elapsed Timers ---------------
function startLiveTimers() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        refreshData().catch(() => {
            // Keep rendering from cache if backend is temporarily unreachable.
        });
        // Update elapsed times in visible tables
        if (currentView === 'exec-dashboard') {
            renderExecDashboard();
        }
        if (currentView === 'import' || currentView === 'export') {
            renderFilteredView(currentView === 'import' ? 'Import' : 'Export');
        }
        if (currentView === 'queue') {
            renderQueue();
        }
        if (currentView === 'officer-release') {
            renderOfficerReleaseQueue();
        }
        updateClock();
    }, 30000); // every 30 seconds

    // Clock updates every second
    setInterval(updateClock, 1000);
}

// --------------- Init ---------------
document.addEventListener('DOMContentLoaded', async () => {
    // Apply saved language on load
    applyStaticTranslations();
    updateLangButton();

    // Set initial page title/breadcrumb from translations
    document.getElementById('page-title').textContent = t('page.exec_dashboard.title');
    document.getElementById('page-breadcrumb').textContent = t('page.exec_dashboard.breadcrumb');

    await initDataStore();
    renderAll();
    if (!isBackendOnline()) {
        showToast('info', 'Backend not reachable. Showing cached data.');
    }
    updateClock();
    startLiveTimers();
});
