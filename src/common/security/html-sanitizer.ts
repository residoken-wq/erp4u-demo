import * as sanitizeHtml from 'sanitize-html';

export const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img',
];

export const SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  transformTags: {
    a: (tagName, attribs) => {
      const href = (attribs.href || '').trim();
      // Only permit http, https, mailto (enforced by allowedSchemes, but double-check)
      if (!href || href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:')) {
        return { tagName: '', attribs: {} };
      }
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    },
    img: (tagName, attribs) => {
      const src = (attribs.src || '').trim();
      if (
        src.startsWith('/uploads/') ||
        src.startsWith('http://') ||
        src.startsWith('https://')
      ) {
        // Disallow data: or javascript: or protocol-relative //
        if (src.toLowerCase().startsWith('data:') || src.toLowerCase().startsWith('javascript:')) {
          return { tagName: '', attribs: {} };
        }
        return {
          tagName: 'img',
          attribs: {
            src,
            ...(attribs.alt ? { alt: attribs.alt } : {}),
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
          },
        };
      }
      return { tagName: '', attribs: {} };
    },
  },
  allowedStyles: {},
};

/**
 * Sanitize user-provided HTML content on write.
 * Strips script, svg, style, on* attributes, javascript: and data: URIs.
 * Allowlist: p br b strong i em u s ul ol li h1-h4 blockquote pre code span table thead tbody tr th td a img.
 */
export function sanitizeHtmlContent(content: string | null | undefined): string {
  if (!content) return '';
  return sanitizeHtml(content, SANITIZER_OPTIONS).trim();
}
