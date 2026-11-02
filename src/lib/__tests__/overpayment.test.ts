import { Alert } from '@/lib/alert';
import { confirmPayment, overpaymentMinor } from '../overpayment';

jest.mock('@/lib/alert', () => ({ Alert: { alert: jest.fn() } }));
const alert = Alert.alert as jest.Mock;

beforeEach(() => alert.mockReset());

describe('overpaymentMinor', () => {
  it('is 0 up to the balance', () => {
    expect(overpaymentMinor(5000000, 2000000)).toBe(0);
    expect(overpaymentMinor(5000000, 5000000)).toBe(0);
  });

  it('is the amount over the balance', () => {
    expect(overpaymentMinor(5000000, 6000000)).toBe(1000000);
  });

  it('counts all of it when nothing is owed', () => {
    expect(overpaymentMinor(0, 500)).toBe(500);
    expect(overpaymentMinor(-1000000, 500)).toBe(500);
  });
});

describe('confirmPayment', () => {
  it('records straight away when within the balance', () => {
    const record = jest.fn();
    confirmPayment(5000000, 5000000, 'NGN', record);
    expect(record).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks first when over the balance, and records only on Record anyway', () => {
    const record = jest.fn();
    confirmPayment(5000000, 6000000, 'NGN', record);
    expect(record).not.toHaveBeenCalled();

    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('More than the balance');
    expect(message).toBe('₦60,000 is ₦10,000 more than the ₦50,000 balance. Record it anyway?');
    buttons.find((b: { text: string }) => b.text === 'Record anyway').onPress();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('asks when no item has a price yet', () => {
    const record = jest.fn();
    confirmPayment(0, 2000000, 'NGN', record);
    expect(alert.mock.calls[0][1]).toBe('₦20,000 is ₦20,000 more than the ₦0 balance. Record it anyway?');
    expect(record).not.toHaveBeenCalled();
  });
});
