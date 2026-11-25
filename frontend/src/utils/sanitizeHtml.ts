import DOMPurify from 'dompurify';

export function getDOMPurify() {
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  if (win) {
    const purifyFactory = (DOMPurify as any).default || DOMPurify;
    const purify = typeof purifyFactory.sanitize === 'function' ? purifyFactory : purifyFactory(win);
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
    // Fallback if no window or DOM (e.g. Node CLI tests / SSR without jsdom):
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
      .replace(/\bhref\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, '')
      .replace(/\bsrc\s*=\s*['"]\s*data:[^'"]*['"]/gi, '');
  }

  if (profile === 'rich') {
    const richConfig: DOMPurify.Config = {
      USE_PROFILES: { html: true },
      ADD_ATTR: [
        'border',
        'cellpadding',
        'cellspacing',
        'bgcolor',
        'align',
        'valign',
        'width',
        'height',
        'colspan',
        'rowspan',
        'style',
        'class',
      ],
      FORBID_TAGS: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'svg',
        'math',
        'base',
        'meta',
        'link',
      ],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      ALLOW_DATA_ATTR: false,
    };
    return purify.sanitize(html, richConfig) as string;
  }

  const basicConfig: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'div',
      'hr', 'sub', 'sup',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'class', 'align', 'valign',
    ],
    FORBID_TAGS: ['script', 'svg', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  };

  return purify.sanitize(html, basicConfig) as string;
}
