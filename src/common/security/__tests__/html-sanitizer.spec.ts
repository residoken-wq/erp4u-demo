import { sanitizeHtmlContent } from '../html-sanitizer';

describe('HTML Sanitizer (Server)', () => {
  it('strips <script> and dangerous tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><svg onload=alert(1)>test</svg>';
    const clean = sanitizeHtmlContent(input);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('<svg');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('strips <img src=x onerror=alert(1)> and malicious image sources', () => {
    const input1 = '<img src=x onerror=alert(1)>';
    const clean1 = sanitizeHtmlContent(input1);
    expect(clean1).not.toContain('onerror');
    expect(clean1).not.toContain('alert');
    expect(clean1).toBe('');

    const input2 = '<img src="data:image/svg+xml;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMSk+" onerror="alert(1)">';
    const clean2 = sanitizeHtmlContent(input2);
    expect(clean2).toBe('');
  });

  it('allows safe images with http/https or /uploads/ and strips inline styles and handlers', () => {
    const input = '<img src="/uploads/images/photo.png" alt="Photo" width="100" style="color:red" onerror="alert(1)">';
    const clean = sanitizeHtmlContent(input);
    expect(clean).toContain('<img src="/uploads/images/photo.png"');
    expect(clean).toContain('alt="Photo"');
    expect(clean).toContain('width="100"');
    expect(clean).not.toContain('style');
    expect(clean).not.toContain('onerror');
  });

  it('strips javascript: and data: links and enforces rel/target on <a>', () => {
    const input1 = '<a href="javascript:alert(1)">Click me</a>';
    const clean1 = sanitizeHtmlContent(input1);
    expect(clean1).not.toContain('href');
    expect(clean1).not.toContain('javascript');

    const input2 = '<a href="https://example.com" onclick="alert(1)">Website</a>';
    const clean2 = sanitizeHtmlContent(input2);
    expect(clean2).toContain('href="https://example.com"');
    expect(clean2).toContain('target="_blank"');
    expect(clean2).toContain('rel="noopener noreferrer"');
    expect(clean2).not.toContain('onclick');
  });

  it('allows basic formatting tags and table structure', () => {
    const input = '<h1>Title</h1><p><b>Bold</b> <i>Italic</i> <u>Underline</u> <s>Strike</s></p>' +
      '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
    const clean = sanitizeHtmlContent(input);
    expect(clean).toContain('<h1>Title</h1>');
    expect(clean).toContain('<b>Bold</b>');
    expect(clean).toContain('<i>Italic</i>');
    expect(clean).toContain('<table>');
    expect(clean).toContain('<td>Data</td>');
  });

  it('allows classes only with ql- and ck- prefixes for editor alignment and indenting', () => {
    const input = '<p class="ql-align-center ck-editor evil-class test">Hello</p><span class="ql-indent-1 normal-class">World</span>';
    const clean = sanitizeHtmlContent(input);
    expect(clean).toContain('class="ql-align-center ck-editor"');
    expect(clean).toContain('class="ql-indent-1"');
    expect(clean).not.toContain('evil-class');
    expect(clean).not.toContain('normal-class');
    expect(clean).not.toContain('test');
  });

  it('handles empty or null inputs gracefully', () => {
    expect(sanitizeHtmlContent('')).toBe('');
    expect(sanitizeHtmlContent(null)).toBe('');
    expect(sanitizeHtmlContent(undefined)).toBe('');
  });
});
