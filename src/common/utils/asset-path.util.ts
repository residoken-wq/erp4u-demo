import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves static assets packaged with core or project root.
 * Supports multiple build and runtime layouts:
 * - Standalone core dev: <root>/<relPath>
 * - Standalone core dist: <root>/dist/<relPath>
 * - Cloud submodule dev: <root>/core/<relPath>
 * - Cloud submodule dist: <root>/dist/core/src/<relPath> or <root>/dist/core/<relPath>
 *
 * @param relPath Relative path to asset (e.g. 'src/ai/knowledge', 'parsed_questions.json', 'frontend/public/uploads')
 * @param baseDir Optional starting directory (defaults to __dirname)
 */
export function resolveCoreAsset(relPath: string, baseDir?: string): string {
  if (path.isAbsolute(relPath) && fs.existsSync(relPath)) {
    return relPath;
  }

  const startDir = baseDir || __dirname;
  const candidates: string[] = [];

  const normalizedRel = path.normalize(relPath);
  const withoutSrc = normalizedRel.startsWith('src' + path.sep)
    ? normalizedRel.slice(4)
    : normalizedRel;

  // 1. Walk up from startDir / baseDir
  let curr = startDir;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(curr, normalizedRel));
    candidates.push(path.join(curr, withoutSrc));
    candidates.push(path.join(curr, 'src', withoutSrc));
    candidates.push(path.join(curr, 'dist', withoutSrc));
    candidates.push(path.join(curr, 'core', normalizedRel));
    candidates.push(path.join(curr, 'core', withoutSrc));
    candidates.push(path.join(curr, 'core', 'src', withoutSrc));
    candidates.push(path.join(curr, 'dist', 'core', 'src', withoutSrc));
    candidates.push(path.join(curr, 'dist', 'core', withoutSrc));
    candidates.push(path.join(curr, 'hr', 'assets', normalizedRel));
    candidates.push(path.join(curr, 'src', 'hr', 'assets', normalizedRel));
    candidates.push(path.join(curr, 'dist', 'hr', 'assets', normalizedRel));

    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  // 2. Relative to process.cwd()
  const cwd = process.cwd();
  candidates.push(path.join(cwd, normalizedRel));
  candidates.push(path.join(cwd, withoutSrc));
  candidates.push(path.join(cwd, 'src', withoutSrc));
  candidates.push(path.join(cwd, 'dist', withoutSrc));
  candidates.push(path.join(cwd, 'core', normalizedRel));
  candidates.push(path.join(cwd, 'core', withoutSrc));
  candidates.push(path.join(cwd, 'core', 'src', withoutSrc));
  candidates.push(path.join(cwd, 'dist', 'core', 'src', withoutSrc));
  candidates.push(path.join(cwd, 'dist', 'core', withoutSrc));
  candidates.push(path.join(cwd, 'src', 'hr', 'assets', normalizedRel));
  candidates.push(path.join(cwd, 'dist', 'hr', 'assets', normalizedRel));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: return cwd relative path if none found
  return path.join(cwd, normalizedRel);
}
