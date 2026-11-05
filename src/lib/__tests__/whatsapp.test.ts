import { whatsappLink, whatsappNumber } from '../whatsapp';

describe('whatsappNumber', () => {
  it('puts +234 in place of a local number’s leading 0', () => {
    expect(whatsappNumber('0803 555 0142')).toBe('2348035550142');
    expect(whatsappNumber('08035550142')).toBe('2348035550142');
    expect(whatsappNumber('0803-555-0142')).toBe('2348035550142');
  });

  it('keeps a number already written with a country code', () => {
    expect(whatsappNumber('+234 803 555 0142')).toBe('2348035550142');
    expect(whatsappNumber('2348035550142')).toBe('2348035550142');
    expect(whatsappNumber('+44 7700 900123')).toBe('447700900123');
    expect(whatsappNumber('0044 7700 900123')).toBe('447700900123');
  });

  it('adds +234 when the leading 0 was left off', () => {
    expect(whatsappNumber('803 555 0142')).toBe('2348035550142');
  });

  it('gives nothing for a number that can’t be dialled from abroad', () => {
    expect(whatsappNumber('')).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber('   ')).toBeNull();
    expect(whatsappNumber('12345')).toBeNull();
    expect(whatsappNumber('0803 555')).toBeNull();
    expect(whatsappNumber('+1234567890123456')).toBeNull();
  });
});

describe('whatsappLink', () => {
  it('opens a chat on wa.me', () => {
    expect(whatsappLink('0803 555 0142')).toBe('https://wa.me/2348035550142');
    expect(whatsappLink('call me')).toBeNull();
  });
});
