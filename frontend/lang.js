// ============================================================
// Shila Dashboard — lang.js
// i18n translations (EN / ID) with localStorage persistence
// Technical terms (L/C, URN, SLA, Status names) stay in English
// ============================================================

const LANG_KEY = 'shila_lang';

const translations = {
    en: {
        // Sidebar
        'nav.main_menu': 'Main Menu',
        'nav.operations': 'Operations',
        'nav.exec_dashboard': 'Executive Dashboard',
        'nav.import': 'Import',
        'nav.export': 'Export',
        'nav.dashboard': 'Dashboard',
        'nav.queue': 'L/C Queue',
        'nav.officer_release': 'Officer Release L/C',
        'nav.create': 'Create Order',
        'nav.master_data': 'Master Data',
        'nav.assignee_master': 'L/C Assignee Master',
        'nav.officer_registration': 'Officer Registration',
        'nav.sla': 'SLA Settings',
        'nav.eventlog': 'Event Log',
        'sidebar.user_role': 'Administrator',

        // Top bar
        'topbar.reset': '↻ Reset Data',

        // Page titles & breadcrumbs
        'page.exec_dashboard.title': 'Executive Dashboard',
        'page.exec_dashboard.breadcrumb': 'Shila Dashboard / Executive Overview',
        'page.import.title': 'Import Operations',
        'page.import.breadcrumb': 'Shila Dashboard / Import',
        'page.export.title': 'Export Operations',
        'page.export.breadcrumb': 'Shila Dashboard / Export',
        'page.dashboard.title': 'Dashboard',
        'page.dashboard.breadcrumb': 'Shila Dashboard / Overview',
        'page.queue.title': 'L/C Processing Queue',
        'page.queue.breadcrumb': 'Shila Dashboard / L/C Queue',
        'page.officer_release.title': 'Officer Release L/C',
        'page.officer_release.breadcrumb': 'Shila Dashboard / Officer Release',
        'page.create.title': 'Create Order',
        'page.create.breadcrumb': 'Shila Dashboard / Create Order',
        'page.assignee_master.title': 'L/C Assignee Master',
        'page.assignee_master.breadcrumb': 'Shila Dashboard / Master Data / Assignee',
        'page.officer_registration.title': 'Officer Registration',
        'page.officer_registration.breadcrumb': 'Shila Dashboard / Master Data / Officer Registration',
        'page.sla.title': 'SLA Settings',
        'page.sla.breadcrumb': 'Shila Dashboard / Settings / SLA',
        'page.eventlog.title': 'Event Log',
        'page.eventlog.breadcrumb': 'Shila Dashboard / Event Log',

        // Create Order
        'create.title': 'Create New Order',
        'create.desc': 'Fill in the details below to create a new L/C order.',
        'create.form.type': 'Transaction Type',
        'create.form.sender': 'Sender Email',
        'create.form.subject': 'Subject',
        'create.form.assigned': 'Assigned To',
        'create.form.assigned_loading': 'Loading assignees...',
        'create.form.submit': '➕ Create Order',

        // Assignee Master
        'assignee.title': 'L/C Assignee Master',
        'assignee.desc': 'Add and manage assignees available for new L/C orders.',
        'assignee.form.name': 'Assignee Name',
        'assignee.form.placeholder': 'Enter assignee name',
        'assignee.form.submit': '➕ Add Assignee',
        'assignee.list_title': 'Assignee List',
        'assignee.col_name': 'Name',
        'assignee.empty': 'No assignee available.',
        'assignee.required': 'Assignee is required.',

        // Officer Registration
        'officer_registration.title': 'Officer Registration',
        'officer_registration.desc': 'Add and manage officers responsible for release approval.',
        'officer_registration.form.name': 'Officer Name',
        'officer_registration.form.placeholder': 'Enter officer name',
        'officer_registration.form.submit': '➕ Add Officer',
        'officer_registration.list_title': 'Officer List',
        'officer_registration.col_name': 'Name',
        'officer_registration.empty': 'No officer available.',
        'officer_registration.required': 'Officer is required.',

        // KPI Cards
        'kpi.active': 'Active L/Cs',
        'kpi.completed': 'Completed Today',
        'kpi.breaches': 'SLA Breaches',
        'kpi.avgtime': 'Avg Processing Time',

        // Stage chart
        'chart.title': 'Average Stage Duration',
        'chart.inbox': 'Inbox Wait',
        'chart.drafting': 'Drafting',
        'chart.checking': 'Checking',
        'chart.total': 'Total Lifecycle',

        // Recent activity
        'recent.title': 'Recent Activity',
        'recent.col_time': 'Time',
        'recent.col_event': 'Event',
        'recent.empty': 'No activity yet. Process an L/C from the Queue.',

        // Dashboard summary
        'summary.title': "Today's L/C Summary",
        'summary.col_urn': 'URN',
        'summary.col_type': 'Type',
        'summary.col_sender': 'Sender',
        'summary.col_status': 'Status',
        'summary.col_received': 'Received',
        'summary.col_elapsed': 'Elapsed',
        'summary.col_sla': 'SLA',

        // Executive Dashboard
        'exec.import_processed': 'Import Processed',
        'exec.export_processed': 'Export Processed',
        'exec.import_sla': 'Import SLA %',
        'exec.export_sla': 'Export SLA %',
        'exec.total_breaches': 'Total Breaches',
        'exec.avg_time': 'Avg Cycle Time',
        'exec.comparison_title': 'Import vs Export: Stage Duration',
        'exec.import_label': 'Import',
        'exec.export_label': 'Export',
        'exec.ai_title': '🤖 AI Performance Summary',
        'exec.ai_generating': 'Generating AI summary...',
        'exec.ai_refresh': '↻ Refresh',
        'exec.combined_activity': 'Combined Recent Activity',

        // Type badges
        'type.import': 'Import',
        'type.export': 'Export',

        // Queue
        'queue.title': 'L/C Processing Queue',
        'queue.search': 'Search URN or sender…',
        'queue.filter_all': 'All',
        'queue.filter_exception': 'Exception',
        'queue.col_num': '#',
        'queue.col_urn': 'URN',
        'queue.col_sender': 'Sender',
        'queue.col_subject': 'Subject',
        'queue.col_assigned': 'Assigned To',
        'queue.col_status': 'Status',
        'queue.col_received': 'Received',
        'queue.col_elapsed': 'Elapsed',
        'queue.col_sla': 'SLA',
        'queue.col_action': 'Action',
        'queue.showing': 'Showing',
        'queue.of': 'of',
        'queue.records': 'records',
        'queue.no_records': 'No records found.',

        // Officer release
        'officer_release.title': 'Officer Release L/C',
        'officer_release.search': 'Search releasable L/C...',
        'officer_release.col_num': '#',
        'officer_release.col_urn': 'URN',
        'officer_release.col_type': 'Type',
        'officer_release.col_sender': 'Sender',
        'officer_release.col_assigned': 'Assigned To',
        'officer_release.col_status': 'Status',
        'officer_release.col_elapsed': 'Elapsed',
        'officer_release.col_action': 'Action',
        'officer_release.no_records': 'No releasable L/C found.',
        'officer_release.select_officer': 'Select officer',

        // Action buttons
        'action.start_drafting': '▶ Start Drafting',
        'action.start_checking': '🔍 Start Checking',
        'action.release': '✅ Release',
        'action.completed': 'Completed',
        'action.resume': '▶ Resume',
        'action.mark_exception': '⏸ Exception',
        'action.resolve_exception': '▶ Resolve Exception',

        // Timeline (L/C Details Modal)
        'timeline.received': 'Received',
        'timeline.drafting': 'Drafting',
        'timeline.checking': 'Checking Underlying',
        'timeline.exception': 'Exception',
        'timeline.released': 'Released',
        'timeline.desc.received': 'L/C Application received in the system.',
        'timeline.desc.drafting': 'Started drafting the documentary credit',
        'timeline.desc.checking': 'Checking documents and trade compliance.',
        'timeline.desc.exception_active': 'Currently paused due to an exception.',
        'timeline.desc.exception_resolved': 'Exception was resolved.',
        'timeline.desc.released': 'L/C has been released via SWIFT.',

        // SLA Settings
        'sla.config_title': '⏱️ SLA Configuration',
        'sla.config_desc': 'Define the minimum and maximum Service Level Agreement thresholds for L/C processing. Items exceeding the maximum will be flagged as breaches.',
        'sla.min_label': 'SLA Minimum (minutes)',
        'sla.max_label': 'SLA Maximum (minutes)',
        'sla.save': '💾 Save Settings',
        'sla.reset_default': 'Reset to Default',
        'sla.data_title': '🗑️ Data Management',
        'sla.data_desc': 'Reset all L/C data, event logs, and SLA configuration back to defaults. This will regenerate 30 fresh mock records.',
        'sla.reset_all': 'Reset All Data',

        // Event Log
        'eventlog.title': 'Event Log',
        'eventlog.clear': 'Clear Log',
        'eventlog.col_timestamp': 'Timestamp',
        'eventlog.col_urn': 'URN',
        'eventlog.col_user': 'User',
        'eventlog.col_action': 'Action',
        'eventlog.col_from': 'From',
        'eventlog.col_to': 'To',
        'eventlog.col_notes': 'Notes',
        'eventlog.empty': 'No events logged yet.',
        'eventlog.events': 'events',

        // SLA Indicators
        'sla.ok': 'OK',
        'sla.warning': 'Warning',
        'sla.breach': 'Breach',

        // Toasts
        'toast.sla_saved': 'SLA settings saved successfully!',
        'toast.sla_reset': 'SLA reset to defaults (90–120 min).',
        'toast.data_reset': 'All data has been regenerated.',
        'toast.log_cleared': 'Event log cleared.',
        'toast.confirm_reset': 'This will reset ALL data (30 new records, clear event log, reset SLA). Continue?',
        'toast.order_created': 'New order created successfully.',
        'toast.assignee_added': 'Assignee added successfully.',
        'toast.assignee_add_failed': 'Failed to add assignee.',
        'toast.officer_added': 'Officer added successfully.',
        'toast.officer_add_failed': 'Failed to add officer.',

        // Event notes
        'note.start_drafting': 'Officer started drafting the L/C.',
        'note.start_checking': 'Draft complete, moved to checking.',
        'note.release': 'L/C released successfully.',
        'note.mark_exception': 'Marked as Exception (SLA paused)',
        'note.resolve_exception': 'Exception resolved. Process resumed.',
        'prompt.mark_exception': 'Enter the reason for exception (e.g., contacting customer, stuck at financing):',
        'prompt.resolve_exception': 'Enter total minutes spent in this exception (Auto-calculated: {0}m):',

        // Lang toggle
        'lang.label': '🇬🇧 EN',
    },

    id: {
        // Sidebar
        'nav.main_menu': 'Menu Utama',
        'nav.operations': 'Operasional',
        'nav.exec_dashboard': 'Dasbor Eksekutif',
        'nav.import': 'Impor',
        'nav.export': 'Ekspor',
        'nav.dashboard': 'Dasbor',
        'nav.queue': 'Antrian L/C',
        'nav.officer_release': 'Rilis L/C Officer',
        'nav.create': 'Buat Pesanan',
        'nav.master_data': 'Data Master',
        'nav.assignee_master': 'Master Penugasan L/C',
        'nav.officer_registration': 'Registrasi Officer',
        'nav.sla': 'Pengaturan SLA',
        'nav.eventlog': 'Log Aktivitas',
        'sidebar.user_role': 'Administrator',

        // Top bar
        'topbar.reset': '↻ Reset Data',

        // Page titles & breadcrumbs
        'page.exec_dashboard.title': 'Dasbor Eksekutif',
        'page.exec_dashboard.breadcrumb': 'Shila Dashboard / Ringkasan Eksekutif',
        'page.import.title': 'Operasi Impor',
        'page.import.breadcrumb': 'Shila Dashboard / Impor',
        'page.export.title': 'Operasi Ekspor',
        'page.export.breadcrumb': 'Shila Dashboard / Ekspor',
        'page.dashboard.title': 'Dasbor',
        'page.dashboard.breadcrumb': 'Shila Dashboard / Ringkasan',
        'page.queue.title': 'Antrian Proses L/C',
        'page.queue.breadcrumb': 'Shila Dashboard / Antrian L/C',
        'page.officer_release.title': 'Rilis L/C Officer',
        'page.officer_release.breadcrumb': 'Shila Dashboard / Rilis Officer',
        'page.create.title': 'Buat Pesanan',
        'page.create.breadcrumb': 'Shila Dashboard / Buat Pesanan',
        'page.assignee_master.title': 'Master Penugasan L/C',
        'page.assignee_master.breadcrumb': 'Shila Dashboard / Data Master / Penugasan',
        'page.officer_registration.title': 'Registrasi Officer',
        'page.officer_registration.breadcrumb': 'Shila Dashboard / Data Master / Registrasi Officer',
        'page.sla.title': 'Pengaturan SLA',
        'page.sla.breadcrumb': 'Shila Dashboard / Pengaturan / SLA',
        'page.eventlog.title': 'Log Aktivitas',
        'page.eventlog.breadcrumb': 'Shila Dashboard / Log Aktivitas',

        // Create Order
        'create.title': 'Buat Pesanan Baru',
        'create.desc': 'Isi detail di bawah ini untuk membuat pesanan L/C baru.',
        'create.form.type': 'Jenis Transaksi',
        'create.form.sender': 'Email Pengirim',
        'create.form.subject': 'Perihal',
        'create.form.assigned': 'Ditugaskan Ke',
        'create.form.assigned_loading': 'Memuat daftar petugas...',
        'create.form.submit': '➕ Buat Pesanan',

        // Assignee Master
        'assignee.title': 'Master Penugasan L/C',
        'assignee.desc': 'Tambah dan kelola petugas untuk pesanan L/C baru.',
        'assignee.form.name': 'Nama Petugas',
        'assignee.form.placeholder': 'Masukkan nama petugas',
        'assignee.form.submit': '➕ Tambah Petugas',
        'assignee.list_title': 'Daftar Petugas',
        'assignee.col_name': 'Nama',
        'assignee.empty': 'Belum ada petugas tersedia.',
        'assignee.required': 'Petugas wajib diisi.',

        // Officer Registration
        'officer_registration.title': 'Registrasi Officer',
        'officer_registration.desc': 'Tambah dan kelola officer yang bertanggung jawab untuk approval release.',
        'officer_registration.form.name': 'Nama Officer',
        'officer_registration.form.placeholder': 'Masukkan nama officer',
        'officer_registration.form.submit': '➕ Tambah Officer',
        'officer_registration.list_title': 'Daftar Officer',
        'officer_registration.col_name': 'Nama',
        'officer_registration.empty': 'Belum ada officer.',
        'officer_registration.required': 'Officer wajib diisi.',

        // KPI Cards
        'kpi.active': 'L/C Aktif',
        'kpi.completed': 'Selesai Hari Ini',
        'kpi.breaches': 'Pelanggaran SLA',
        'kpi.avgtime': 'Rata-rata Waktu Proses',

        // Stage chart
        'chart.title': 'Rata-rata Durasi Tahapan',
        'chart.inbox': 'Menunggu di Inbox',
        'chart.drafting': 'Drafting',
        'chart.checking': 'Checking',
        'chart.total': 'Total Siklus',

        // Recent activity
        'recent.title': 'Aktivitas Terkini',
        'recent.col_time': 'Waktu',
        'recent.col_event': 'Peristiwa',
        'recent.empty': 'Belum ada aktivitas. Proses L/C dari Antrian.',

        // Dashboard summary
        'summary.title': 'Ringkasan L/C Hari Ini',
        'summary.col_urn': 'URN',
        'summary.col_type': 'Tipe',
        'summary.col_sender': 'Pengirim',
        'summary.col_status': 'Status',
        'summary.col_received': 'Diterima',
        'summary.col_elapsed': 'Berlalu',
        'summary.col_sla': 'SLA',

        // Executive Dashboard
        'exec.import_processed': 'Impor Diproses',
        'exec.export_processed': 'Ekspor Diproses',
        'exec.import_sla': 'SLA Impor %',
        'exec.export_sla': 'SLA Ekspor %',
        'exec.total_breaches': 'Total Pelanggaran',
        'exec.avg_time': 'Rata-rata Siklus',
        'exec.comparison_title': 'Impor vs Ekspor: Durasi Tahapan',
        'exec.import_label': 'Impor',
        'exec.export_label': 'Ekspor',
        'exec.ai_title': '🤖 Ringkasan Kinerja AI',
        'exec.ai_generating': 'Membuat ringkasan AI...',
        'exec.ai_refresh': '↻ Perbarui',
        'exec.combined_activity': 'Aktivitas Gabungan Terkini',

        // Type badges
        'type.import': 'Impor',
        'type.export': 'Ekspor',

        // Queue
        'queue.title': 'Antrian Proses L/C',
        'queue.search': 'Cari URN atau pengirim…',
        'queue.filter_all': 'Semua',
        'queue.filter_exception': 'Pengecualian',
        'queue.col_num': '#',
        'queue.col_urn': 'URN',
        'queue.col_sender': 'Pengirim',
        'queue.col_subject': 'Perihal',
        'queue.col_assigned': 'Ditugaskan',
        'queue.col_status': 'Status',
        'queue.col_received': 'Diterima',
        'queue.col_elapsed': 'Berlalu',
        'queue.col_sla': 'SLA',
        'queue.col_action': 'Aksi',
        'queue.showing': 'Menampilkan',
        'queue.of': 'dari',
        'queue.records': 'data',
        'queue.no_records': 'Tidak ada data ditemukan.',

        // Officer release
        'officer_release.title': 'Rilis L/C Officer',
        'officer_release.search': 'Cari L/C siap rilis...',
        'officer_release.col_num': '#',
        'officer_release.col_urn': 'URN',
        'officer_release.col_type': 'Tipe',
        'officer_release.col_sender': 'Pengirim',
        'officer_release.col_assigned': 'Ditugaskan',
        'officer_release.col_status': 'Status',
        'officer_release.col_elapsed': 'Berlalu',
        'officer_release.col_action': 'Aksi',
        'officer_release.no_records': 'Tidak ada L/C yang siap dirilis.',
        'officer_release.select_officer': 'Pilih officer',

        // Action buttons
        'action.start_drafting': '▶ Mulai Drafting',
        'action.start_checking': '🔍 Mulai Checking',
        'action.release': '✅ Release',
        'action.completed': 'Selesai',
        'action.resume': '▶ Lanjutkan',
        'action.mark_exception': '⏸ Pengecualian',
        'action.resolve_exception': '▶ Selesaikan Pengecualian',

        // Timeline (L/C Details Modal)
        'timeline.received': 'Diterima',
        'timeline.drafting': 'Drafting',
        'timeline.checking': 'Pemeriksaan Underlying',
        'timeline.exception': 'Pengecualian',
        'timeline.released': 'Dirilis',
        'timeline.desc.received': 'Aplikasi L/C diterima di sistem.',
        'timeline.desc.drafting': 'Mulai menyusun dokumen kredit',
        'timeline.desc.checking': 'Memeriksa dokumen dan kepatuhan perdagangan.',
        'timeline.desc.exception_active': 'Sedang dijeda karena pengecualian.',
        'timeline.desc.exception_resolved': 'Pengecualian telah diselesaikan.',
        'timeline.desc.released': 'L/C telah dirilis melalui SWIFT.',

        // SLA Settings
        'sla.config_title': '⏱️ Konfigurasi SLA',
        'sla.config_desc': 'Tentukan batas minimum dan maksimum Service Level Agreement untuk proses L/C. Item yang melebihi batas maksimum akan ditandai sebagai pelanggaran.',
        'sla.min_label': 'SLA Minimum (menit)',
        'sla.max_label': 'SLA Maksimum (menit)',
        'sla.save': '💾 Simpan Pengaturan',
        'sla.reset_default': 'Kembali ke Default',
        'sla.data_title': '🗑️ Manajemen Data',
        'sla.data_desc': 'Reset semua data L/C, log aktivitas, dan konfigurasi SLA ke pengaturan awal. Ini akan membuat ulang 30 data baru.',
        'sla.reset_all': 'Reset Semua Data',

        // Event Log
        'eventlog.title': 'Log Aktivitas',
        'eventlog.clear': 'Hapus Log',
        'eventlog.col_timestamp': 'Waktu',
        'eventlog.col_urn': 'URN',
        'eventlog.col_user': 'Pengguna',
        'eventlog.col_action': 'Aksi',
        'eventlog.col_from': 'Dari',
        'eventlog.col_to': 'Ke',
        'eventlog.col_notes': 'Catatan',
        'eventlog.empty': 'Belum ada log aktivitas.',
        'eventlog.events': 'aktivitas',

        // SLA Indicators
        'sla.ok': 'OK',
        'sla.warning': 'Peringatan',
        'sla.breach': 'Pelanggaran',

        // Toasts
        'toast.sla_saved': 'Pengaturan SLA berhasil disimpan!',
        'toast.sla_reset': 'SLA dikembalikan ke default (90–120 menit).',
        'toast.data_reset': 'Semua data telah dibuat ulang.',
        'toast.log_cleared': 'Log aktivitas dihapus.',
        'toast.confirm_reset': 'Ini akan mereset SEMUA data (30 data baru, hapus log, reset SLA). Lanjutkan?',
        'toast.order_created': 'Pesanan baru berhasil dibuat.',
        'toast.assignee_added': 'Petugas berhasil ditambahkan.',
        'toast.assignee_add_failed': 'Gagal menambahkan petugas.',
        'toast.officer_added': 'Officer berhasil ditambahkan.',
        'toast.officer_add_failed': 'Gagal menambahkan officer.',

        // Event notes
        'note.start_drafting': 'Petugas mulai drafting L/C.',
        'note.start_checking': 'Draft selesai, lanjut ke checking.',
        'note.release': 'L/C berhasil di-release.',
        'note.mark_exception': 'Ditandai sebagai Pengecualian (SLA dijeda)',
        'note.resolve_exception': 'Pengecualian selesai. Proses dilanjutkan.',
        'prompt.mark_exception': 'Masukkan alasan pengecualian (misalnya: menghubungi nasabah, kendala pembiayaan):',
        'prompt.resolve_exception': 'Masukkan total menit yang dihabiskan untuk pengecualian ini (Dihitung otomatis: {0}m):',

        // Lang toggle
        'lang.label': '🇮🇩 ID',
    },
};

// --------------- Public API ---------------

function getLang() {
    return localStorage.getItem(LANG_KEY) || 'en';
}

function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
}

function t(key) {
    const lang = getLang();
    return (translations[lang] && translations[lang][key]) || translations['en'][key] || key;
}

function toggleLang() {
    const current = getLang();
    const next = current === 'en' ? 'id' : 'en';
    setLang(next);
    applyStaticTranslations();
    updateLangButton();
    // Re-trigger switchView to update page title & breadcrumb in new language
    if (typeof currentView !== 'undefined') {
        switchView(currentView);
    } else {
        renderAll();
    }
}

function updateLangButton() {
    const btn = document.getElementById('lang-toggle');
    if (btn) {
        btn.textContent = t('lang.label');
    }
}

function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (el.tagName === 'INPUT' && el.type !== 'number') {
            el.placeholder = val;
        } else {
            el.textContent = val;
        }
    });
}
