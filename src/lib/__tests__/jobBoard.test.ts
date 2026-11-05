import {
  dueGroup,
  dueLabel,
  groupByState,
  jobMeta,
  filterJobs,
  groupJobs,
  initials,
  jobState,
  owedByClient,
  weekEnd,
  weekSummary,
  type JobRow,
} from '../jobBoard';

// Wednesday 5 November 2026, mid-afternoon, on this phone's clock.
const NOW = new Date(2026, 10, 5, 15, 30).getTime();
const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();

function row(over: Partial<JobRow>): JobRow {
  return {
    jobId: 'j',
    clientId: 'c',
    clientName: 'Tunde Bello',
    label: 'Job',
    itemCount: 1,
    currency: 'NGN',
    collectOn: null,
    createdAt: 0,
    totalMinor: 1000,
    paidMinor: 0,
    balanceMinor: 1000,
    ...over,
  };
}

describe('jobState', () => {
  it('is Still owed while the balance is above 0, otherwise Paid', () => {
    expect(jobState({ totalMinor: 1000, paidMinor: 400, balanceMinor: 600 })).toBe('owed');
    expect(jobState({ totalMinor: 1000, paidMinor: 1000, balanceMinor: 0 })).toBe('paid');
    expect(jobState({ totalMinor: 0, paidMinor: 500, balanceMinor: -500 })).toBe('paid');
  });

  it('has no state yet when nothing is priced or paid', () => {
    expect(jobState({ totalMinor: 0, paidMinor: 0, balanceMinor: 0 })).toBe('unpriced');
  });
});

describe('filterJobs', () => {
  const rows = [
    row({ jobId: 'owed' }),
    row({ jobId: 'paid', paidMinor: 1000, balanceMinor: 0 }),
    row({ jobId: 'new', totalMinor: 0, balanceMinor: 0 }),
  ];

  it('shows everything under All, and only matching jobs otherwise', () => {
    expect(filterJobs(rows, 'all').map((r) => r.jobId)).toEqual(['owed', 'paid', 'new']);
    expect(filterJobs(rows, 'owed').map((r) => r.jobId)).toEqual(['owed']);
    expect(filterJobs(rows, 'paid').map((r) => r.jobId)).toEqual(['paid']);
  });
});

describe('dueGroup', () => {
  it('counts today and the next six days as this week', () => {
    expect(weekEnd(NOW)).toBe(new Date(2026, 10, 12).getTime());
    expect(dueGroup(row({ collectOn: day(5, 9) }), NOW)).toBe('week'); // earlier today
    expect(dueGroup(row({ collectOn: day(11, 23) }), NOW)).toBe('week');
    expect(dueGroup(row({ collectOn: day(12, 0) }), NOW)).toBe('later');
  });

  it('splits past dates by whether money is still owed', () => {
    expect(dueGroup(row({ collectOn: day(4) }), NOW)).toBe('overdue');
    expect(dueGroup(row({ collectOn: day(4), paidMinor: 1000, balanceMinor: 0 }), NOW)).toBe('earlier');
  });

  it('puts a job with no date under No date yet', () => {
    expect(dueGroup(row({ collectOn: null }), NOW)).toBe('none');
  });
});

describe('groupJobs', () => {
  it('orders the sections and sorts inside each one', () => {
    const rows = [
      row({ jobId: 'later', collectOn: day(21) }),
      row({ jobId: 'sat', collectOn: day(8) }),
      row({ jobId: 'fri', collectOn: day(7) }),
      row({ jobId: 'old-paid', collectOn: day(2), paidMinor: 1000, balanceMinor: 0 }),
      row({ jobId: 'older-paid', collectOn: day(1), paidMinor: 1000, balanceMinor: 0 }),
      row({ jobId: 'undated-old', createdAt: 1 }),
      row({ jobId: 'undated-new', createdAt: 2 }),
      row({ jobId: 'late', collectOn: day(3) }),
    ];
    expect(groupJobs(rows, NOW).map((s) => [s.title, s.rows.map((r) => r.jobId)])).toEqual([
      ['Overdue', ['late']],
      ['Due this week', ['fri', 'sat']],
      ['Later', ['later']],
      ['No date yet', ['undated-new', 'undated-old']],
      ['Earlier', ['old-paid', 'older-paid']],
    ]);
  });

  it('leaves out empty sections', () => {
    expect(groupJobs([row({ collectOn: day(7) })], NOW).map((s) => s.key)).toEqual(['week']);
    expect(groupJobs([], NOW)).toEqual([]);
  });
});

describe('weekSummary', () => {
  it('counts the jobs due, the next date and what is still owed', () => {
    const rows = [
      row({ clientId: 'a', collectOn: day(8), balanceMinor: 6000000 }),
      row({ clientId: 'a', collectOn: day(7), paidMinor: 1000, balanceMinor: 0 }),
      row({ clientId: 'b', collectOn: day(3), balanceMinor: 2500000 }), // overdue
      row({ clientId: 'c', collectOn: day(21), balanceMinor: 9500000 }),
      row({ clientId: 'd', balanceMinor: -500000 }), // overpaid: doesn't offset
    ];
    expect(weekSummary(rows, NOW)).toEqual({
      dueCount: 3,
      nextDue: day(7),
      owedMinor: 18000000,
      owedClients: 3,
    });
  });

  it('has no next date when nothing is due this week', () => {
    expect(weekSummary([row({ collectOn: day(3) })], NOW)).toMatchObject({ dueCount: 1, nextDue: null });
  });
});

describe('owedByClient', () => {
  it('adds up each client’s balances above 0', () => {
    const owed = owedByClient([
      row({ clientId: 'a', balanceMinor: 600 }),
      row({ clientId: 'a', balanceMinor: 400 }),
      row({ clientId: 'a', balanceMinor: -300 }),
      row({ clientId: 'b', balanceMinor: 0 }),
    ]);
    expect([...owed]).toEqual([['a', 1000]]);
  });
});

describe('initials', () => {
  it('takes the first and last names', () => {
    expect(initials('Tunde Bello')).toBe('TB');
    expect(initials('  mary jane  watson ')).toBe('MW');
    expect(initials('Kemi')).toBe('K');
    expect(initials('')).toBe('?');
  });
});

describe('dueLabel', () => {
  it('names the weekday when it is due this week', () => {
    expect(dueLabel(day(5), NOW)).toBe('Due Thu 5 Nov');
    expect(dueLabel(day(11), NOW)).toBe('Due Wed 11 Nov');
  });

  it('gives the day and month otherwise, this year', () => {
    expect(dueLabel(day(12), NOW)).toBe('Due 12 Nov');
    expect(dueLabel(new Date(2026, 7, 2).getTime(), NOW)).toBe('Due 2 Aug');
  });

  it('adds the year when it isn’t this year', () => {
    expect(dueLabel(new Date(2025, 10, 9).getTime(), NOW)).toBe('Due 9 Nov 2025');
    expect(dueLabel(new Date(2027, 0, 3).getTime(), NOW)).toBe('Due 3 Jan 2027');
  });
});

describe('jobMeta', () => {
  it('counts the items and adds the due date when there is one', () => {
    expect(jobMeta({ itemCount: 2, collectOn: day(12) }, NOW)).toBe('2 items · Due 12 Nov');
    expect(jobMeta({ itemCount: 1, collectOn: null }, NOW)).toBe('1 item');
  });
});

describe('groupByState', () => {
  it('puts Still owed first, then Paid, then No price yet, newest first in each', () => {
    const rows = [
      row({ jobId: 'paid-old', createdAt: 1, totalMinor: 500, paidMinor: 500, balanceMinor: 0 }),
      row({ jobId: 'owed', createdAt: 2 }),
      row({ jobId: 'unpriced', createdAt: 3, totalMinor: 0, paidMinor: 0, balanceMinor: 0 }),
      row({ jobId: 'paid-new', createdAt: 4, totalMinor: 500, paidMinor: 600, balanceMinor: -100 }),
    ];
    expect(groupByState(rows).map((g) => [g.title, g.rows.map((r) => r.jobId)])).toEqual([
      ['Still owed', ['owed']],
      ['Paid', ['paid-new', 'paid-old']],
      ['No price yet', ['unpriced']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupByState([row({})]).map((g) => g.key)).toEqual(['owed']);
    expect(groupByState([])).toEqual([]);
  });
});
