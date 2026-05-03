// Lightweight i18n scaffold. No runtime dep. To add a locale, drop a new file
// in this folder and add it to `locales`. Components access strings via t(key).

import esMX from './es-MX.js';

const locales = { 'es-MX': esMX };
const DEFAULT = 'es-MX';

let currentLocale = DEFAULT;

export function setLocale(loc) {
  if (locales[loc]) currentLocale = loc;
}

export function getLocale() {
  return currentLocale;
}

// Looks up a dotted path in the active locale, falling back to DEFAULT and
// finally to the key itself so the UI doesn't break on missing strings.
export function t(key, params) {
  const dict = locales[currentLocale] || locales[DEFAULT];
  let val = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
  if (val == null && currentLocale !== DEFAULT) {
    val = key.split('.').reduce((o, k) => (o == null ? o : o[k]), locales[DEFAULT]);
  }
  if (val == null) return key;
  if (params && typeof val === 'string') {
    return val.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
  }
  return val;
}

export const SUPPORTED_LOCALES = Object.keys(locales);
