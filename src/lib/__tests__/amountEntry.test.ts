import {
  addThousands,
  bufferToMinor,
  deleteDigit,
  halfOf,
  minorToBuffer,
  pressDigit,
} from '../amountEntry';

describe('money pad', () => {
  it('builds a number and drops leading zeros', () => {
    expect(pressDigit('', '4')).toBe('4');
    expect(pressDigit('4', '5')).toBe('45');
    expect(pressDigit('', '0')).toBe('');
    expect(pressDigit('0', '7')).toBe('7');
  });

  it('stops at nine digits', () => {
    expect(pressDigit('123456789', '1')).toBe('123456789');
    expect(addThousands('1234567')).toBe('1234567');
  });

  it('turns 45 then ,000 into 45000', () => {
    expect(addThousands('45')).toBe('45000');
    expect(addThousands('')).toBe('');
  });

  it('deletes the last digit', () => {
    expect(deleteDigit('45')).toBe('4');
    expect(deleteDigit('')).toBe('');
  });

  it('converts to and from minor units', () => {
    expect(bufferToMinor('50000')).toBe(5000000);
    expect(bufferToMinor('')).toBe(0);
    expect(minorToBuffer(5000000)).toBe('50000');
    expect(minorToBuffer(0)).toBe('');
    expect(minorToBuffer(-500)).toBe('');
  });

  it('rounds Half up to a whole unit', () => {
    expect(halfOf(11000000)).toBe('55000');
    expect(halfOf(11100)).toBe('56');
    expect(halfOf(0)).toBe('');
  });
});
