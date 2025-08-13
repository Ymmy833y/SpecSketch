const i18n = { get, localize };

function get(key: string, subs?: string[]) {
  return chrome.i18n.getMessage(key, subs) || key;
}

function localize(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = get(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach(el => {
    const spec = el.getAttribute('data-i18n-attr');
    if (!spec) return;
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map(s => s?.trim());
      if (attr && key) el.setAttribute(attr, get(key));
    }
  });
}

export default i18n;
