export interface StageDuration {
  key: 'inbox' | 'drafting' | 'checking' | 'exception';
  labelKey: string;
  minutes: number;
  isActive: boolean;
  isLongest: boolean;
}

const MS_PER_MINUTE = 60000;

type StageRecord = {
  transactionType?: string;
  status?: string;
  receivedAt?: string;
  draftingStartedAt?: string;
  checkingStartedAt?: string;
  releasedAt?: string;
  exceptionStartedAt?: string;
  exceptionTotalMinutes?: number;
};

export function getStageKeyType(transactionType?: string): string {
  if (!transactionType) return 'import';
  const t = transactionType.toLowerCase().replace(' ', '_');
  return t === 'bank_guarantee' ? 'bank_guarantee' : t;
}

export function getChartLabel(transactionType: string | undefined, stageGroup: string): string {
  if (stageGroup === 'exception') return 'timeline.exception';
  return `chart.${getStageKeyType(transactionType)}.${stageGroup}`;
}

export function getTimelineLabel(transactionType: string | undefined, stageGroup: string): string {
  if (stageGroup === 'exception') return 'timeline.exception';
  return `timeline.${getStageKeyType(transactionType)}.${stageGroup}`;
}

export function getActionLabel(transactionType: string | undefined, actionGroup: string): string {
  if (actionGroup === 'release') return 'action.release'; // global
  return `action.${getStageKeyType(transactionType)}.${actionGroup}`;
}

function parseTime(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function minsBetween(startTs: number, endTs: number): number {
  return Math.max(0, Math.round((endTs - startTs) / MS_PER_MINUTE));
}

export function computeLcStageDurations(record: StageRecord, nowTs = Date.now()): StageDuration[] {
  const status = record.status || '';
  const receivedTs = parseTime(record.receivedAt);
  const draftingTs = parseTime(record.draftingStartedAt);
  const checkingTs = parseTime(record.checkingStartedAt);
  const releasedTs = parseTime(record.releasedAt);
  const exceptionStartedTs = parseTime(record.exceptionStartedAt);

  if (receivedTs === null) return [];

  const stages: StageDuration[] = [];

  if (draftingTs !== null) {
    stages.push({ key: 'inbox', labelKey: getChartLabel(record.transactionType, 'inbox'), minutes: minsBetween(receivedTs, draftingTs), isActive: false, isLongest: false });
  } else if (status === 'Received') {
    stages.push({ key: 'inbox', labelKey: getChartLabel(record.transactionType, 'inbox'), minutes: minsBetween(receivedTs, nowTs), isActive: true, isLongest: false });
  }

  if (draftingTs !== null) {
    if (checkingTs !== null) {
      stages.push({ key: 'drafting', labelKey: getChartLabel(record.transactionType, 'drafting'), minutes: minsBetween(draftingTs, checkingTs), isActive: false, isLongest: false });
    } else if (status === 'Drafting') {
      stages.push({ key: 'drafting', labelKey: getChartLabel(record.transactionType, 'drafting'), minutes: minsBetween(draftingTs, nowTs), isActive: true, isLongest: false });
    }
  }

  if (checkingTs !== null) {
    if (releasedTs !== null) {
      stages.push({ key: 'checking', labelKey: getChartLabel(record.transactionType, 'checking'), minutes: minsBetween(checkingTs, releasedTs), isActive: false, isLongest: false });
    } else if (status === 'Checking Underlying' || status === 'Breached') {
      stages.push({ key: 'checking', labelKey: getChartLabel(record.transactionType, 'checking'), minutes: minsBetween(checkingTs, nowTs), isActive: true, isLongest: false });
    }
  }

  let exceptionMinutes = Math.max(0, record.exceptionTotalMinutes || 0);
  let exceptionLive = false;
  if (status === 'Exception' && exceptionStartedTs !== null) {
    exceptionMinutes += minsBetween(exceptionStartedTs, nowTs);
    exceptionLive = true;
  }
  if (exceptionMinutes > 0) {
    stages.push({
      key: 'exception',
      labelKey: 'timeline.exception',
      minutes: exceptionMinutes,
      isActive: exceptionLive,
      isLongest: false,
    });
  }

  const maxMinutes = stages.reduce((max, stage) => Math.max(max, stage.minutes), 0);
  return stages.map((stage) => ({ ...stage, isLongest: maxMinutes > 0 && stage.minutes === maxMinutes }));
}

export function computeAverageStageDurations(records: StageRecord[]): StageDuration[] {
  const sampleType = records.length > 0 ? records[0].transactionType : undefined;
  const totals: Record<StageDuration['key'], { sum: number; count: number; labelKey: string }> = {
    inbox: { sum: 0, count: 0, labelKey: getChartLabel(sampleType, 'inbox') },
    drafting: { sum: 0, count: 0, labelKey: getChartLabel(sampleType, 'drafting') },
    checking: { sum: 0, count: 0, labelKey: getChartLabel(sampleType, 'checking') },
    exception: { sum: 0, count: 0, labelKey: 'timeline.exception' },
  };

  records.forEach((record) => {
    const stages = computeLcStageDurations(record);
    stages.forEach((stage) => {
      totals[stage.key].sum += stage.minutes;
      totals[stage.key].count += 1;
      totals[stage.key].labelKey = stage.labelKey;
    });
  });

  const averages: StageDuration[] = (Object.keys(totals) as StageDuration['key'][])
    .filter((key) => totals[key].count > 0)
    .map((key) => {
      const entry = totals[key];
      return {
        key,
        labelKey: entry.labelKey,
        minutes: Math.round(entry.sum / entry.count),
        isActive: false,
        isLongest: false,
      };
    });

  const maxMinutes = averages.reduce((max, stage) => Math.max(max, stage.minutes), 0);
  return averages.map((stage) => ({ ...stage, isLongest: maxMinutes > 0 && stage.minutes === maxMinutes }));
}

export function findLongestStage(stages: StageDuration[]): StageDuration | null {
  if (!stages.length) return null;
  return stages.reduce((longest, current) => (current.minutes > longest.minutes ? current : longest), stages[0]);
}

export function formatMinutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
