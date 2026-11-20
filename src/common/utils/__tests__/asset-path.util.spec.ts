import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveCoreAsset } from '../asset-path.util';

describe('Asset Path Resolver (resolveCoreAsset)', () => {
  let tempBaseDir: string;

  beforeAll(async () => {
    tempBaseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'erp4u-asset-test-'));
  });

  afterAll(async () => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      await fs.promises.rm(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('Layout 1 (Standalone core): resolves assets in dist/... and src/...', async () => {
    // Structure:
    // tempBaseDir/
    //   dist/
    //     ai/
    //       ai-knowledge.service.js (baseDir)
    //       knowledge/
    //         company-policies.json
    //     hr/
    //       assets/
    //         parsed_questions.json
    const distAiDir = path.join(tempBaseDir, 'dist', 'ai');
    const distKbDir = path.join(tempBaseDir, 'dist', 'ai', 'knowledge');
    const distHrAssetsDir = path.join(tempBaseDir, 'dist', 'hr', 'assets');
    fs.mkdirSync(distKbDir, { recursive: true });
    fs.mkdirSync(distHrAssetsDir, { recursive: true });

    const kbFile = path.join(distKbDir, 'company-policies.json');
    const hrFile = path.join(distHrAssetsDir, 'parsed_questions.json');
    fs.writeFileSync(kbFile, JSON.stringify([{ topic: 'test', content: 'hello' }]));
    fs.writeFileSync(hrFile, JSON.stringify([{ content: 'q1' }]));

    // Resolve KB path from dist/ai
    const resolvedKb = resolveCoreAsset('src/ai/knowledge', distAiDir);
    expect(fs.existsSync(resolvedKb)).toBe(true);
    expect(path.normalize(resolvedKb)).toBe(path.normalize(distKbDir));

    // Resolve HR questions from dist/ai
    const resolvedHr = resolveCoreAsset('parsed_questions.json', distAiDir);
    expect(fs.existsSync(resolvedHr)).toBe(true);
    expect(path.normalize(resolvedHr)).toBe(path.normalize(hrFile));
  });

  it('Layout 2 (Cloud submodule): resolves assets in dist/core/src/... and core/...', async () => {
    // Structure:
    // tempBaseDir/
    //   dist/
    //     core/
    //       src/
    //         ai/
    //           ai-knowledge.service.js (baseDir)
    //           knowledge/
    //             company-policies.json
    //         hr/
    //           assets/
    //             parsed_questions.json
    //   core/
    //     frontend/
    //       public/
    //         uploads/
    const cloudDistAiDir = path.join(tempBaseDir, 'cloud-app', 'dist', 'core', 'src', 'ai');
    const cloudKbDir = path.join(tempBaseDir, 'cloud-app', 'dist', 'core', 'src', 'ai', 'knowledge');
    const cloudHrAssetsDir = path.join(tempBaseDir, 'cloud-app', 'dist', 'core', 'src', 'hr', 'assets');
    const cloudUploadsDir = path.join(tempBaseDir, 'cloud-app', 'core', 'frontend', 'public', 'uploads');

    fs.mkdirSync(cloudKbDir, { recursive: true });
    fs.mkdirSync(cloudHrAssetsDir, { recursive: true });
    fs.mkdirSync(cloudUploadsDir, { recursive: true });

    const cloudKbFile = path.join(cloudKbDir, 'company-policies.json');
    const cloudHrFile = path.join(cloudHrAssetsDir, 'parsed_questions.json');
    const cloudUploadSample = path.join(cloudUploadsDir, 'sample.png');

    fs.writeFileSync(cloudKbFile, '{}');
    fs.writeFileSync(cloudHrFile, '[]');
    fs.writeFileSync(cloudUploadSample, 'fake png');

    // Resolve KB from cloud submodule dist
    const resolvedKb = resolveCoreAsset('src/ai/knowledge', cloudDistAiDir);
    expect(fs.existsSync(resolvedKb)).toBe(true);
    expect(path.normalize(resolvedKb)).toBe(path.normalize(cloudKbDir));

    // Resolve HR questions from cloud submodule dist
    const resolvedHr = resolveCoreAsset('parsed_questions.json', cloudDistAiDir);
    expect(fs.existsSync(resolvedHr)).toBe(true);
    expect(path.normalize(resolvedHr)).toBe(path.normalize(cloudHrFile));

    // Resolve uploads dir from cloud submodule dist
    const resolvedUploads = resolveCoreAsset(path.join('frontend', 'public', 'uploads'), cloudDistAiDir);
    expect(fs.existsSync(resolvedUploads)).toBe(true);
    expect(path.normalize(resolvedUploads)).toBe(path.normalize(cloudUploadsDir));
  });

  it('falls back to process.cwd() when file does not exist', () => {
    const nonexistent = 'nonexistent/file/path.json';
    const resolved = resolveCoreAsset(nonexistent);
    expect(resolved).toBe(path.join(process.cwd(), nonexistent));
  });

  it('returns absolute path directly if it exists', () => {
    const existingFile = path.resolve(__filename);
    const resolved = resolveCoreAsset(existingFile);
    expect(resolved).toBe(existingFile);
  });
});
