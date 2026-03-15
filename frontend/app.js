// ============================================================
// Shila Dashboard — app.js
// Interactive logic: navigation, rendering, state transitions
// ============================================================

// --------------- State ---------------
let currentView = 'dashboard';
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
        dashboard: 'page.dashboard.title',
        queue: 'page.queue.title',
        create: 'page.create.title',
        sla: 'page.sla.title',
        eventlog: 'page.eventlog.title',
    };
    const crumbKeys = {
        dashboard: 'page.dashboard.breadcrumb',
        queue: 'page.queue.breadcrumb',
        create: 'page.create.breadcrumb',
        sla: 'page.sla.breadcrumb',
        eventlog: 'page.eventlog.breadcrumb',
    };
    document.getElementById('page-title').textContent = t(titleKeys[view] || 'page.dashboard.title');
    document.getElementById('page-breadcrumb').textContent = t(crumbKeys[view] || 'page.dashboard.breadcrumb');

    // Render the active view
    renderAll();
}

// --------------- Rendering ---------------
function renderAll() {
    applyStaticTranslations();
    renderKPIs();
    renderStageChart();
    renderRecentActivity();
    renderDashboardSummary();
    renderQueue();
    renderSlaForm();
    renderEventLog();
    updateQueueBadge();
    updateLangButton();
}

function renderKPIs() {
    const data = getData();
    const sla = getSlaConfig();

    const active = data.filter(r => r.status !== 'Released').length;
    const completed = data.filter(r => r.status === 'Released').length;
    const breaches = data.filter(r => {
        const elapsed = getElapsedMinutes(r);
        return elapsed > sla.slaMaxMinutes && r.status !== 'Released' && r.status !== 'Exception';
    }).length + data.filter(r => r.status === 'Breached').length;

    // Avg processing time for released
    const releasedItems = data.filter(r => r.status === 'Released' && r.releasedAt);
    let avgTime = 0;
    if (releasedItems.length > 0) {
        const totalMin = releasedItems.reduce((sum, r) => {
            return sum + Math.round((new Date(r.releasedAt) - new Date(r.receivedAt)) / 60000);
        }, 0);
        avgTime = Math.round(totalMin / releasedItems.length);
    }

    document.getElementById('kpi-active').textContent = active;
    document.getElementById('kpi-completed').textContent = completed;
    document.getElementById('kpi-breaches').textContent = breaches;
    document.getElementById('kpi-avgtime').textContent = avgTime + 'm';
}

function renderStageChart() {
    const data = getData();
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

    const avgInbox = avg(inboxWaits);
    const avgDraft = avg(draftingTimes);
    const avgCheck = avg(checkingTimes);
    const avgTotal = avg(totalTimes);

    setBar('bar-inbox', avgInbox, maxVal);
    setBar('bar-drafting', avgDraft, maxVal);
    setBar('bar-checking', avgCheck, maxVal);
    setBar('bar-total', avgTotal, maxVal);
}

function setBar(id, value, maxVal) {
    const el = document.getElementById(id);
    if (!el) return;
    const pct = Math.min(100, Math.max(5, (Math.abs(value) / maxVal) * 100));
    el.style.width = pct + '%';
    el.textContent = Math.abs(Math.round(value)) + ' min';
}

function renderRecentActivity() {
    const log = getEventLog().slice(0, 8);
    const tbody = document.getElementById('recent-activity-body');
    if (!tbody) return;

    if (log.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:2rem">${t('recent.empty')}</td></tr>`;
        return;
    }

    tbody.innerHTML = log.map(e => `
    <tr>
      <td style="white-space:nowrap;font-size:0.775rem;color:var(--text-muted)">${formatTime(e.timestamp)}</td>
      <td><strong>${e.urn}</strong> → ${e.to} <span style="color:var(--text-muted);font-size:0.75rem">by ${e.user}</span></td>
    </tr>
  `).join('');
}

function renderDashboardSummary() {
    const data = getData();
    const sla = getSlaConfig();
    const tbody = document.getElementById('dashboard-summary-body');
    if (!tbody) return;

    tbody.innerHTML = data.slice(0, 15).map(r => `
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
            r.assignedTo.toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem">${t('queue.no_records')}</td></tr>`;
    } else {
        tbody.innerHTML = filtered.map((r, i) => `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td><a class="urn-link" onclick="showLcDetails(${r.id})"><strong>${r.urn}</strong></a></td>
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

function updateQueueBadge() {
    const data = getData();
    const active = data.filter(r => r.status !== 'Released').length;
    const badge = document.getElementById('queue-badge');
    if (badge) {
        badge.textContent = active;
    }
}

// --------------- SLA ---------------
function renderSlaForm() {
    const sla = getSlaConfig();
    const minEl = document.getElementById('sla-min');
    const maxEl = document.getElementById('sla-max');
    if (minEl) minEl.value = sla.slaMinMinutes;
    if (maxEl) maxEl.value = sla.slaMaxMinutes;
}

function handleSaveSla() {
    const slaMin = parseInt(document.getElementById('sla-min').value) || 90;
    const slaMax = parseInt(document.getElementById('sla-max').value) || 120;
    saveSlaConfig({ slaMinMinutes: slaMin, slaMaxMinutes: slaMax });
    showToast('success', t('toast.sla_saved'));
    renderAll();
}

function handleResetSla() {
    saveSlaConfig({ slaMinMinutes: 90, slaMaxMinutes: 120 });
    renderSlaForm();
    showToast('info', t('toast.sla_reset'));
    renderAll();
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
    localStorage.removeItem('shila_event_log');
    renderEventLog();
    showToast('info', t('toast.log_cleared'));
}

// --------------- Actions ---------------
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

function handleAction(id, action, payload = null) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;

    const prevStatus = record.status;
    let newStatus = '';
    let notes = '';

    switch (action) {
        case 'start-drafting':
            record.status = 'Drafting';
            record.draftingStartedAt = new Date().toISOString();
            newStatus = 'Drafting';
            notes = t('note.start_drafting');
            break;
        case 'start-checking':
            record.status = 'Checking Underlying';
            record.checkingStartedAt = new Date().toISOString();
            newStatus = 'Checking Underlying';
            notes = t('note.start_checking');
            break;
        case 'release':
            record.status = 'Released';
            record.releasedAt = new Date().toISOString();
            newStatus = 'Released';
            notes = t('note.release');
            break;
        case 'mark-exception':
            record.previousStatus = record.status;
            record.status = 'Exception';
            record.exceptionStartedAt = new Date().toISOString();
            record.exceptionReason = payload || '';
            newStatus = 'Exception';
            notes = t('note.mark_exception') + (payload ? `: ${payload}` : '');
            break;
        case 'resolve-exception':
            if (record.exceptionStartedAt) {
                const exceptionMins = payload !== null ? payload : Math.round((Date.now() - new Date(record.exceptionStartedAt)) / 60000);
                record.exceptionTotalMinutes = (record.exceptionTotalMinutes || 0) + exceptionMins;
            }
            record.status = record.previousStatus || 'Drafting';
            record.exceptionStartedAt = null;
            record.exceptionReason = null;
            newStatus = record.status;
            notes = t('note.resolve_exception');
            break;
        default:
            return;
    }

    saveData(data);
    addEventLog({
        urn: record.urn,
        user: record.assignedTo,
        action: action.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        from: prevStatus,
        to: newStatus,
        notes: notes,
    });

    showToast('success', `${record.urn} → ${newStatus}`);
    renderAll();
}

function handleCreateOrder(event) {
    event.preventDefault(); // Prevent default form submission

    // Get input values
    const senderEmail = document.getElementById('create-sender').value;
    const subject = document.getElementById('create-subject').value;
    const assignedTo = document.getElementById('create-assigned').value;

    const data = getData();

    // Generate URN: LC-YYYYMMDD-XXX
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const nextId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
    const urn = `LC-${dateStr}-${String(nextId).padStart(3, '0')}`;

    // Create new record
    const newRecord = {
        id: nextId,
        urn: urn,
        senderEmail: senderEmail,
        subject: subject,
        assignedTo: assignedTo,
        status: 'Received',
        receivedAt: new Date().toISOString(),
        draftingStartedAt: null,
        checkingStartedAt: null,
        releasedAt: null,
        exceptionTotalMinutes: 0,
        exceptionStartedAt: null,
        exceptionReason: null,
        previousStatus: null,
    };

    // Add to data and save
    data.unshift(newRecord); // Add to the top of the queue
    saveData(data);

    // Log the event
    addEventLog({
        urn: urn,
        user: assignedTo,
        action: 'Create Order',
        from: '—',
        to: 'Received',
        notes: 'Manually created via form',
    });

    // Reset form
    event.target.reset();

    // Show success toast and redirect
    showToast('success', t('toast.order_created'));
    switchView('queue');
}

function handleReset() {
    if (!confirm(t('toast.confirm_reset'))) return;
    resetAllData();
    renderAll();
    showToast('info', t('toast.data_reset'));
}

// --------------- HTML Builders ---------------
function showLcDetails(id) {
    const data = getData();
    const record = data.find(r => r.id === id);
    if (!record) return;

    document.getElementById('modal-urn-title').textContent = record.urn;
    document.getElementById('modal-subject').textContent = record.subject;
    
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
            return `<button class="action-btn success" onclick="handleAction(${record.id}, 'release')">${t('action.release')}</button>
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
        // Update elapsed times in visible tables
        if (currentView === 'dashboard') {
            renderKPIs();
            // Only update elapsed cells, not full re-render
        }
        if (currentView === 'queue') {
            renderQueue();
        }
        updateClock();
    }, 30000); // every 30 seconds

    // Clock updates every second
    setInterval(updateClock, 1000);
}

// --------------- Init ---------------
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved language on load
    applyStaticTranslations();
    updateLangButton();

    // Set initial page title/breadcrumb from translations
    document.getElementById('page-title').textContent = t('page.dashboard.title');
    document.getElementById('page-breadcrumb').textContent = t('page.dashboard.breadcrumb');

    renderAll();
    updateClock();
    startLiveTimers();
});
