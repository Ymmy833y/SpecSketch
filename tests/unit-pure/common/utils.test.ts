import { timestamp } from '@common/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('timestamp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats with zero padding and positive sign for UTC+09:00 (e.g., JST)', () => {
    // Arrange: Fixed date with single-digit components to verify zero-padding
    const d = new Date('2024-01-02T03:04:05.000Z');
    vi.spyOn(d, 'getFullYear').mockReturnValue(2024);
    vi.spyOn(d, 'getMonth').mockReturnValue(0); // January -> +1 => 1 -> "01"
    vi.spyOn(d, 'getDate').mockReturnValue(2); // "02"
    vi.spyOn(d, 'getHours').mockReturnValue(3); // "03"
    vi.spyOn(d, 'getMinutes').mockReturnValue(4); // "04"
    vi.spyOn(d, 'getSeconds').mockReturnValue(5); // "05"
    // JST (UTC+9) => Date#getTimezoneOffset() = -540
    vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(-540);

    // Act
    const actual = timestamp(d);

    // Assert
    expect(actual).toBe('2024-01-02_03-04-05+0900');
  });

  it('uses negative sign for UTC-07:00 and keeps minutes as 00', () => {
    // Arrange: Two-digit components (no padding edge here, just sign/offset check)
    const d = new Date('1999-12-31T23:58:59.000Z');
    vi.spyOn(d, 'getFullYear').mockReturnValue(1999);
    vi.spyOn(d, 'getMonth').mockReturnValue(11); // December -> +1 => 12
    vi.spyOn(d, 'getDate').mockReturnValue(31);
    vi.spyOn(d, 'getHours').mockReturnValue(23);
    vi.spyOn(d, 'getMinutes').mockReturnValue(58);
    vi.spyOn(d, 'getSeconds').mockReturnValue(59);
    // UTC-7 => offset = +420 minutes, tzo = -420 => sign '-'
    vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(420);

    // Act
    const actual = timestamp(d);

    // Assert
    expect(actual).toBe('1999-12-31_23-58-59-0700');
  });

  it('handles half-hour timezones (e.g., UTC+05:30 -> +0530)', () => {
    // Arrange: Any components are fine; we care about mm part of offset = 30
    const d = new Date('2021-06-15T10:20:30.000Z');
    vi.spyOn(d, 'getFullYear').mockReturnValue(2021);
    vi.spyOn(d, 'getMonth').mockReturnValue(5); // June -> +1 => 6 -> "06"
    vi.spyOn(d, 'getDate').mockReturnValue(15); // "15"
    vi.spyOn(d, 'getHours').mockReturnValue(10); // "10"
    vi.spyOn(d, 'getMinutes').mockReturnValue(20); // "20"
    vi.spyOn(d, 'getSeconds').mockReturnValue(30); // "30"
    // UTC+05:30 => offset = -330 minutes
    vi.spyOn(d, 'getTimezoneOffset').mockReturnValue(-330);

    // Act
    const actual = timestamp(d);

    // Assert
    expect(actual).toBe('2021-06-15_10-20-30+0530');
  });
});
