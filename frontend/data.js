// ============================================================
// Shila Dashboard — data.js
// Mock data store with localStorage persistence
// ============================================================

const STORAGE_KEY = 'shila_lc_data';
const SLA_KEY = 'shila_sla_config';
const EVENT_LOG_KEY = 'shila_event_log';

// --------------- Default SLA Config ---------------
const DEFAULT_SLA = { slaMinMinutes: 90, slaMaxMinutes: 120 };

// --------------- Helpers ---------------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function pad(n) {
  return String(n).padStart(3, '0');
}

function minutesAgo(m) {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

// --------------- Seed Data Generator ---------------
function generateMockData() {
  const officers = [
    'Rina Hartono', 'Budi Setiawan', 'Dewi Lestari',
    'Andi Pratama', 'Siti Nurhaliza', 'Fajar Hidayat',
    'Mega Putri', 'Hendra Wijaya'
  ];

  const senders = [
    'trade@clientbank.com', 'ops@exporter-co.id', 'lc-dept@globalfin.com',
    'docs@importhouse.sg', 'credits@asiabank.hk', 'finance@tradewind.my',
    'operations@pacificbank.com', 'swift@eurofinance.de'
  ];

  const reasons = [
    'Contacting customer for document clarification',
    'Pending approval from credit risk team',
    'Stuck at financing verification',
    'Waiting for beneficiary confirmation',
    'System error during SWIFT generation'
  ];

  const subjects = [
    'Import L/C Application – PO#8821',
    'New L/C Request – Invoice INV-4420',
    'Urgent: L/C Amendment Request',
    'L/C Issuance for Commodity Shipment',
    'Re: L/C Draft Confirmation Needed',
    'L/C Opening – Beneficiary ABC Corp',
    'Trade Finance: New L/C Instruction',
    'L/C Request – Machinery Import',
    'Documentary Credit Application',
    'L/C Issuance – Raw Materials Order'
  ];

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const records = [];

  // Distribution: at least 20/30 in Drafting, Checking, or Released
  // Status distribution plan:
  //   Received:              4
  //   Drafting:              8
  //   Checking Underlying:   7
  //   Released:              8
  //   Breached:              3
  // Total = 30, Drafting+Checking+Released = 23 (> 2/3)

  const statusPlan = [
    ...Array(4).fill('Received'),
    ...Array(8).fill('Drafting'),
    ...Array(7).fill('Checking Underlying'),
    ...Array(8).fill('Released'),
    ...Array(3).fill('Breached'),
  ];

  // Shuffle
  for (let i = statusPlan.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [statusPlan[i], statusPlan[j]] = [statusPlan[j], statusPlan[i]];
  }

  for (let i = 0; i < 30; i++) {
    const status = statusPlan[i];
    const receivedMinutesAgo = randomInt(20, 300);
    const receivedAt = minutesAgo(receivedMinutesAgo);

    let draftingStartedAt = null;
    let checkingStartedAt = null;
    let releasedAt = null;
    let exceptionTotalMinutes = 0;
    let exceptionStartedAt = null;
    let exceptionReason = null;
    let previousStatus = null;

    if (status === 'Drafting') {
      draftingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(5, 20));
    } else if (status === 'Checking Underlying') {
      draftingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(5, 15));
      checkingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(20, 50));
      
      // Seed some active Exceptions
      if (Math.random() > 0.8) {
          status = 'Exception';
          previousStatus = 'Checking Underlying';
          exceptionStartedAt = minutesAgo(receivedMinutesAgo - randomInt(5, 15));
          exceptionReason = randomItem(reasons);
      }

    } else if (status === 'Released') {
      draftingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(5, 15));
      checkingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(20, 50));
      releasedAt = minutesAgo(receivedMinutesAgo - randomInt(55, Math.min(receivedMinutesAgo - 5, 110)));
      
      // Simulate some past exception time
      if (Math.random() > 0.7) {
          exceptionTotalMinutes = randomInt(15, 120);
          exceptionReason = randomItem(reasons);
      }

    } else if (status === 'Breached') {
      // Breached = stuck too long somewhere
      draftingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(5, 15));
      if (Math.random() > 0.5) {
        checkingStartedAt = minutesAgo(receivedMinutesAgo - randomInt(20, 40));
      }
    }

    records.push({
      id: i + 1,
      urn: `LC-${dateStr}-${pad(i + 1)}`,
      senderEmail: randomItem(senders),
      subject: randomItem(subjects),
      status: status,
      receivedAt: receivedAt,
      draftingStartedAt: draftingStartedAt,
      checkingStartedAt: checkingStartedAt,
      releasedAt: releasedAt,
      exceptionTotalMinutes: exceptionTotalMinutes,
      exceptionStartedAt: exceptionStartedAt,
      exceptionReason: exceptionReason,
      previousStatus: previousStatus,
      assignedTo: randomItem(officers),
    });
  }

  return records;
}

// --------------- Public API ---------------

function getData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // corrupted — regenerate
    }
  }
  const data = generateMockData();
  saveData(data);
  return data;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSlaConfig() {
  const stored = localStorage.getItem(SLA_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) { /* fall through */ }
  }
  saveSlaConfig(DEFAULT_SLA);
  return { ...DEFAULT_SLA };
}

function saveSlaConfig(config) {
  localStorage.setItem(SLA_KEY, JSON.stringify(config));
}

function getEventLog() {
  const stored = localStorage.getItem(EVENT_LOG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) { /* fall through */ }
  }
  return [];
}

function addEventLog(entry) {
  const log = getEventLog();
  log.unshift({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(log));
}

function resetAllData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SLA_KEY);
  localStorage.removeItem(EVENT_LOG_KEY);
}
