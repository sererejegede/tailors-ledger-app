import {
  backupStatus,
  fractionLabel,
  parseNextReceiptNumber,
  paymentSummary,
  shopSummary,
  templatesSummary,
  type BackupInput,
} from '../settingsSummary';

const ago = () => '2 minutes ago';
const signedIn: BackupInput = {
  configured: true,
  email: 'shop@example.com',
  syncing: false,
  lastSyncedAt: 1000,
  lastError: null,
  rejected: 0,
  blocked: false,
};

describe('backupStatus', () => {
  it('is green once a backup has gone through', () => {
    expect(backupStatus(signedIn, ago)).toEqual({
      tone: 'ok',
      title: 'Backed up 2 minutes ago',
      detail: 'shop@example.com',
    });
  });

  it('is grey when signed out or when backup is not set up', () => {
    expect(backupStatus({ ...signedIn, email: null }, ago)).toMatchObject({ tone: 'off', title: 'Not backed up' });
    expect(backupStatus({ ...signedIn, configured: false }, ago)).toMatchObject({
      tone: 'off',
      title: 'Saved on this phone',
    });
  });

  it('says so while a backup runs', () => {
    expect(backupStatus({ ...signedIn, syncing: true }, ago).title).toBe('Backing up…');
  });

  it('is amber when something is stuck', () => {
    expect(backupStatus({ ...signedIn, lastSyncedAt: null }, ago)).toMatchObject({
      tone: 'warn',
      title: 'Not backed up yet',
    });
    expect(backupStatus({ ...signedIn, lastError: 'offline' }, ago).title).toBe('Backup failed');
    expect(backupStatus({ ...signedIn, blocked: true }, ago).title).toBe('Backup paused');
    expect(backupStatus({ ...signedIn, rejected: 2 }, ago)).toMatchObject({
      tone: 'warn',
      title: 'Backed up 2 minutes ago',
    });
  });
});

describe('row summaries', () => {
  it('shows the bank and the last four digits', () => {
    expect(paymentSummary('GTBank', '0123456789')).toBe('GTBank ··· 6789');
    expect(paymentSummary('GTBank', '')).toBe('GTBank');
    expect(paymentSummary('', '0123456789')).toBe('··· 6789');
    expect(paymentSummary(undefined, '  ')).toBe('Not set');
  });

  it('shows the shop name, or what the screen holds', () => {
    expect(shopSummary(' Kunle Couture ')).toBe('Kunle Couture');
    expect(shopSummary('')).toBe('Name, logo, receipts');
  });

  it('counts templates and names the default', () => {
    expect(
      templatesSummary([
        { name: "Men's", isDefault: true },
        { name: "Women's", isDefault: false },
        { name: 'Kids', isDefault: false },
      ]),
    ).toBe("3 · Men's is default");
    expect(templatesSummary([{ name: 'Kids', isDefault: false }])).toBe('1');
    expect(templatesSummary([])).toBe('None yet');
  });

  it('shows the fraction step', () => {
    expect(fractionLabel('quarters')).toBe('¼');
    expect(fractionLabel('eighths')).toBe('⅛');
    expect(fractionLabel(undefined)).toBe('¼');
  });
});

describe('parseNextReceiptNumber', () => {
  it('can be raised', () => {
    expect(parseNextReceiptNumber(' 120 ', 43)).toEqual({ ok: true, value: 120 });
    expect(parseNextReceiptNumber('0043', 43)).toEqual({ ok: true, value: 43 });
  });

  it('is never lowered, so a number is never reused', () => {
    expect(parseNextReceiptNumber('42', 43)).toEqual({ ok: false, error: 'It can’t go below R-0043.' });
  });

  it('takes whole numbers only', () => {
    expect(parseNextReceiptNumber('', 1)).toMatchObject({ ok: false });
    expect(parseNextReceiptNumber('4.5', 1)).toMatchObject({ ok: false });
    expect(parseNextReceiptNumber('0', 1)).toMatchObject({ ok: false });
  });
});
