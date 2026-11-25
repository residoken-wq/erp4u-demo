import DOMPurify from 'dompurify';

export function getDOMPurify() {
  if (typeof window !== 'undefined') {
    const purify = typeof (DOMPurify as any).sanitize === 'function' ? DOMPurify : (DOMPurify as any)(window);
    if (purify && purify.addHook && !(purify as any)._hookAdded) {
      purify.addHook('afterSanitizeAttributes', (node: any) => {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
      (purify as any)._hookAdded = true;
    }
    return purify;
  }
  return null;
}

export function sanitizeClientHtml(html: string | null | undefined, profile: 'basic' | 'rich' = 'basic'): string {
  if (!html) return '';
  const purify = getDOMPurify();
  if (!purify || typeof purify.sanitize !== 'function') {
    // Fallback if no window or DOM (e.g. Node CLI tests / SSR):
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
      .replace(/\bhref\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, '')
      .replace(/\bsrc\s*=\s*['"]\s*data:[^'"]*['"]/gi, '');
  }

  const config: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'div',
      'hr', 'sub', 'sup',
    ],
    ALLOWED_ATTR: profile === 'rich'
      ? ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'style', 'class', 'align', 'valign']
      : ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'class', 'align', 'valign'],
    FORBID_TAGS: ['script', 'svg', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: profile === 'rich' ? ['onerror', 'onload', 'onclick'] : ['style', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  };

  return purify.sanitize(html, config) as string;
}
