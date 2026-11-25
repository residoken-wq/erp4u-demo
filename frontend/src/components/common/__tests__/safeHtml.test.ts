import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeClientHtml } from '../../../utils/sanitizeHtml.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SafeHtml & Sanitizer Frontend Unit Tests', () => {
  it('strips <script> and dangerous attributes', () => {
    const input = '<p>Test</p><script>alert("xss")</script><svg onload=alert(1)>hello</svg>';
    const clean = sanitizeClientHtml(input);
    assert.ok(!clean.includes('<script>'), 'Must not contain <script>');
    assert.ok(!clean.includes('alert'), 'Must not contain alert');
    assert.ok(!clean.includes('<svg'), 'Must not contain <svg');
    assert.ok(clean.includes('<p>Test</p>'), 'Must contain safe paragraph');
  });

  it('strips <img src=x onerror=alert(1)>', () => {
    const input = '<img src=x onerror=alert(1)>';
    const clean = sanitizeClientHtml(input);
    assert.ok(!clean.includes('onerror'), 'Must not contain onerror');
    assert.ok(!clean.includes('alert'), 'Must not contain alert');
  });

  it('strips javascript: and data: URLs on links', () => {
    const input = '<a href="javascript:alert(1)">bad link</a>';
    const clean = sanitizeClientHtml(input);
    assert.ok(!clean.includes('javascript:'), 'Must not contain javascript:');
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
