import '@testing-library/jest-dom';

import i18n from '@common/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('common/i18n.localize', () => {
  const getMessage = vi.mocked(chrome.i18n.getMessage);

  beforeEach(() => {
    document.body.innerHTML = '';
    getMessage.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces textContent for elements with data-i18n', () => {
    // Arrange
    const dict: Record<string, string> = { hello: 'Hello' };
    getMessage.mockImplementation((key: string) => dict[key] ?? '');

    const root = document.createElement('div');
    root.innerHTML = `<p id="t" data-i18n="hello">PLACEHOLDER</p>`;
    document.body.appendChild(root);

    // Act
    i18n.localize(root);

    // Assert
    const p = root.querySelector('#t')!;
    expect(p).toHaveTextContent('Hello');
  });

  it('sets multiple attributes from data-i18n-attr with trimming', () => {
    // Arrange
    const dict: Record<string, string> = { 'title.key': 'Title', 'aria.key': 'Explain' };
    getMessage.mockImplementation((key: string) => dict[key] ?? '');

    const root = document.createElement('div');
    root.innerHTML = `
      <a id="link" data-i18n-attr="  title : title.key ;  aria-label : aria.key  "></a>
    `;
    document.body.appendChild(root);

    // Act
    i18n.localize(root);

    // Assert
    const a = root.querySelector('#link')!;
    expect(a).toHaveAttribute('title', 'Title');
    expect(a).toHaveAttribute('aria-label', 'Explain');
  });

  it('ignores invalid attr:key pairs and empty spec safely', () => {
    // Arrange
    const dict: Record<string, string> = { 'id.key': 'my-id' };
    getMessage.mockImplementation((key: string) => dict[key] ?? '');

    const root = document.createElement('div');
    root.innerHTML = `
      <button id="b1" data-i18n-attr=""></button>
      <button id="b2" data-i18n-attr="href; :bad ; id: id.key "></button>
    `;
    document.body.appendChild(root);

    // Act
    const b1 = root.querySelector('#b1') as HTMLButtonElement;
    const b2 = root.querySelector('#b2') as HTMLButtonElement;

    // Act
    i18n.localize(root);

    // Assert
    // b1: Nothing is set
    expect(b1.getAttribute('title')).toBeNull();

    // b2: id is changed to my-id (invalid pair is ignored)
    expect(b2).toHaveAttribute('id', 'my-id');
    // href was an invalid pair and was not set
    expect(b2.getAttribute('href')).toBeNull();

    expect(root.querySelector('#b2')).toBeNull();
    expect(root.querySelector('#my-id')).toBe(b2);
  });

  it('localizes the entire document when no root is provided (default param)', () => {
    // Arrange
    const dict: Record<string, string> = { hello: 'Hello' };
    getMessage.mockImplementation((key: string) => dict[key] ?? '');

    document.body.innerHTML = `<span id="global" data-i18n="hello"></span>`;

    // Act
    i18n.localize(); // No arguments → whole document

    // Assert
    expect(document.querySelector('#global')).toHaveTextContent('Hello');
  });
});
