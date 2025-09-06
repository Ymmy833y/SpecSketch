import { CHANNEL, isChannel, isPanelContentPort, PROTOCOL_VERSION } from '@common/constants';
import { describe, expect, it } from 'vitest';

const makePort = (name?: string): chrome.runtime.Port =>
  name === undefined
    ? ({} as unknown as chrome.runtime.Port)
    : ({ name } as unknown as chrome.runtime.Port);

describe('common/constants', () => {
  describe('CHANNEL / PROTOCOL_VERSION', () => {
    it('PANEL_CONTENT follows PROTOCOL_VERSION', () => {
      // Arrange
      const expected = `spsk:panel-content:v${PROTOCOL_VERSION}`;

      // Act
      const actual = CHANNEL.PANEL_CONTENT;

      // Assert
      expect(actual).toBe(expected);
    });
  });

  describe('isChannel', () => {
    const target = CHANNEL.PANEL_CONTENT;

    it('returns true when port.name exactly matches', () => {
      // Arrange
      const port = makePort(target);

      // Act
      const ok = isChannel(port, target);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns false when names differ', () => {
      // Arrange
      const port = makePort('spsk:another-channel:v1');

      // Act
      const ok = isChannel(port, target);

      // Assert
      expect(ok).toBe(false);
    });

    it('is strict: trailing spaces or case changes do not match', () => {
      // Arrange
      const spaced = makePort(`${target} `);
      const upper = makePort(target.toUpperCase());

      // Act
      const spacedOk = isChannel(spaced, target);
      const upperOk = isChannel(upper, target);

      // Assert
      expect(spacedOk).toBe(false);
      expect(upperOk).toBe(false);
    });

    it('returns false when port has no "name" property', () => {
      // Arrange
      const port = makePort(undefined);

      // Act
      const ok = isChannel(port, target);

      // Assert
      expect(ok).toBe(false);
    });
  });

  describe('isPanelContentPort', () => {
    it('returns true when name equals CHANNEL.PANEL_CONTENT', () => {
      // Arrange
      const port = makePort(CHANNEL.PANEL_CONTENT);

      // Act
      const ok = isPanelContentPort(port);

      // Assert
      expect(ok).toBe(true);
    });

    it('returns false when name is different (e.g., different version)', () => {
      // Arrange
      const port = makePort('spsk:panel-content:v0');

      // Act
      const ok = isPanelContentPort(port);

      // Assert
      expect(ok).toBe(false);
    });

    it('behaves identically to isChannel(port, CHANNEL.PANEL_CONTENT)', () => {
      // Arrange
      const candidates = [CHANNEL.PANEL_CONTENT, 'abc', `${CHANNEL.PANEL_CONTENT} `];

      for (const name of candidates) {
        const port = makePort(name);

        // Act
        const viaWrapper = isPanelContentPort(port);
        const viaDirect = isChannel(port, CHANNEL.PANEL_CONTENT);

        // Assert
        expect(viaWrapper).toBe(viaDirect);
      }
    });
  });
});
