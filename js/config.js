const CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbzSIY9YFWLWZh7eYF4RCWxe_m4xrHF-SqJ21xcfCYpV9PO_xEHrIn4NuSHWcMI33PPZ6w/exec',
  appName: 'QuizPro'
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(selector, root) {
  return (root || document).querySelector(selector);
}

function els(selector, root) {
  return Array.from((root || document).querySelectorAll(selector));
}

function isTruthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE' || value === 'yes';
}
