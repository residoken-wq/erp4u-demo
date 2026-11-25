import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Initialize JSDOM globally before importing sanitizeClientHtml
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).Node = dom.window.Node;

import { sanitizeClientHtml, getDOMPurify } from '../../../utils/sanitizeHtml.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SafeHtml & Sanitizer Frontend Unit Tests', () => {
  it('runs through REAL DOMPurify instance (not regex fallback)', () => {
    const purify = getDOMPurify();
    assert.ok(purify, 'DOMPurify must be initialized via JSDOM window');
    assert.equal(typeof purify.sanitize, 'function', 'sanitize must be a function on DOMPurify');
  });

  it('strips <script> and dangerous attributes on basic profile', () => {
    const input = '<p>Test</p><script>alert("xss")</script><svg onload=alert(1)>hello</svg>';
    const clean = sanitizeClientHtml(input, 'basic');
    assert.ok(!clean.includes('<script>'), 'Must not contain <script>');
    assert.ok(!clean.includes('alert'), 'Must not contain alert');
    assert.ok(!clean.includes('<svg'), 'Must not contain <svg');
    assert.ok(clean.includes('<p>Test</p>'), 'Must contain safe paragraph');
  });

  it('strips <img src=x onerror=alert(1)> on basic profile', () => {
    const input = '<img src=x onerror=alert(1)>';
    const clean = sanitizeClientHtml(input, 'basic');
    assert.ok(!clean.includes('onerror'), 'Must not contain onerror');
    assert.ok(!clean.includes('alert'), 'Must not contain alert');
  });

  it('strips javascript: and data: URLs on links and adds target/rel hook', () => {
    const input = '<a href="javascript:alert(1)">bad link</a><a href="https://example.com">good link</a>';
    const clean = sanitizeClientHtml(input, 'basic');
    assert.ok(!clean.includes('javascript:'), 'Must not contain javascript:');
    assert.ok(clean.includes('href="https://example.com"'), 'Must keep safe link');
    assert.ok(clean.includes('rel="noopener noreferrer"'), 'Must add rel="noopener noreferrer"');
    assert.ok(clean.includes('target="_blank"'), 'Must add target="_blank"');
  });

  it('profile "rich": preserves PO table border="1" and inline styles', () => {
    const poHtml = '<table border="1" cellpadding="5" cellspacing="0" bgcolor="#f9f9f9" style="width: 100%; border-collapse: collapse;"><tbody><tr><td style="color: blue; text-align: right;">Item 1</td></tr></tbody></table>';
    const clean = sanitizeClientHtml(poHtml, 'rich');
    assert.ok(clean.includes('border="1"'), 'Must preserve border="1"');
    assert.ok(clean.includes('cellpadding="5"'), 'Must preserve cellpadding');
    assert.ok(clean.includes('cellspacing="0"'), 'Must preserve cellspacing');
    assert.ok(clean.includes('bgcolor="#f9f9f9"'), 'Must preserve bgcolor');
    assert.ok(clean.includes('style='), 'Must preserve style attribute');
    assert.ok(clean.includes('color: blue') || clean.includes('color:blue'), 'Must preserve style contents');
  });

  it('profile "rich": preserves contract structure with h5, font, center, colgroup, col, hr', () => {
    const contractHtml = '<h5>ĐIỀU KHOẢN HỢP ĐỒNG</h5><center><font color="red">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</font></center><hr/><table><colgroup><col width="120"><col width="300"></colgroup><thead><tr><th>Mục</th><th>Chi tiết</th></tr></thead><tbody><tr><td>1</td><td>Nội dung</td></tr></tbody></table>';
    const clean = sanitizeClientHtml(contractHtml, 'rich');
    assert.ok(clean.includes('<h5>') && clean.includes('</h5>'), 'Must preserve <h5>');
    assert.ok(clean.includes('<center>') && clean.includes('</center>'), 'Must preserve <center>');
    assert.ok(clean.includes('<font') && clean.includes('</font>'), 'Must preserve <font>');
    assert.ok(clean.includes('<colgroup>') && clean.includes('</colgroup>'), 'Must preserve <colgroup>');
    assert.ok(clean.includes('<col') && clean.includes('width="120"'), 'Must preserve <col> and width');
    assert.ok(clean.includes('<hr'), 'Must preserve <hr>');
  });

  it('profile "rich": strictly forbids <img onerror>, <script>, <iframe>, <a href="javascript:">, <style>', () => {
    const attacks = `
      <table border="1" style="color: green;"><tr><td>Safe</td></tr></table>
      <img src="x" onerror="alert('xss1')">
      <script>alert('xss2')</script>
      <iframe src="https://evil.com"></iframe>
      <a href="javascript:alert('xss3')">Click here</a>
      <style>body { display: none; }</style>
    `;
    const clean = sanitizeClientHtml(attacks, 'rich');

    assert.ok(!clean.includes('onerror'), 'Must strip onerror');
    assert.ok(!clean.includes('<script'), 'Must strip <script> tag');
    assert.ok(!clean.includes('<iframe'), 'Must strip <iframe> tag');
    assert.ok(!clean.includes('javascript:'), 'Must strip javascript: URI');
    assert.ok(!clean.includes('<style'), 'Must strip <style> tag');
    assert.ok(!clean.includes('alert('), 'Must not contain alert calls');

    // Retains safe parts
    assert.ok(clean.includes('border="1"'), 'Must retain table border="1"');
    assert.ok(clean.includes('style='), 'Must retain safe inline style');
    assert.ok(clean.includes('Safe'), 'Must retain text content');
  });

  it('Scan test: no dangerouslySetInnerHTML outside SafeHtml.tsx in frontend/src', () => {
    const srcDir = path.resolve(__dirname, '../../../');
    const violations: { file: string; line: number; text: string }[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          if (entry.name === 'SafeHtml.tsx' || entry.name.endsWith('.test.ts')) continue;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('dangerouslySet' + 'InnerHTML')) {
              violations.push({
                file: path.relative(srcDir, fullPath),
                line: idx + 1,
                text: line.trim(),
              });
            }
          });
        }
      }
    }

    scanDir(srcDir);
    assert.deepEqual(violations, [], `Found dangerouslySetInnerHTML outside SafeHtml.tsx: ${JSON.stringify(violations)}`);
  });
});
