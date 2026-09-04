const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'blockquote', 'a', 'div', 'span',
]);

const escapeAttribute = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const sanitizeRichText = (value) => {
  const raw = String(value || '');
  if (raw.length > 50000) throw new Error('Blog content is too long');

  const withoutDangerousBlocks = raw
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\/?\s*(script|style|iframe|object|embed|svg|math)[^>]*>/gi, '');

  const sanitized = withoutDangerousBlocks.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawTag, rawAttributes) => {
    const tag = String(rawTag || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (/^<\s*\//.test(match)) return `</${tag}>`;
    if (tag === 'br') return '<br />';

    if (tag === 'a') {
      const hrefMatch = String(rawAttributes || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = String(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || '').trim();
      if (/^(https?:|mailto:)/i.test(href)) {
        return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">`;
      }
      return '<a>';
    }

    return `<${tag}>`;
  });

  const text = sanitized
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error('Blog content is required');

  return sanitized;
};

module.exports = { sanitizeRichText };
