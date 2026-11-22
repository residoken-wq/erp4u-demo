import test from 'node:test';
import assert from 'node:assert';
import { loadDemoModeOnce, resetDemoModeCache, getCachedDemoMode } from '../useDemoMode.ts';

test('useDemoMode unit tests (Task P7c6b)', async (t) => {
  t.beforeEach(() => {
    resetDemoModeCache();
  });

  await t.test('initial / waiting state defaults to false before promise resolution', () => {
    assert.strictEqual(getCachedDemoMode(), null);
  });

  await t.test('fail-closed: meta { demo: false } returns false (no demo text)', async () => {
    let fetchCalls = 0;
    const mockFetcher = async () => {
      fetchCalls++;
      return { data: { demo: false } };
    };

    const isDemo = await loadDemoModeOnce(mockFetcher);
    assert.strictEqual(isDemo, false);
    assert.strictEqual(getCachedDemoMode(), false);
    assert.strictEqual(fetchCalls, 1);

    // Verify UI simulation: when isDemo is false, demo text must not appear
    const renderLoginDemoUI = (demoActive: boolean) => {
      const elements: string[] = [];
      if (demoActive) {
        elements.push('Trải nghiệm Demo? Chọn tài khoản mẫu');
        elements.push('Danh sách tài khoản Demo');
      }
      return elements.join(' | ');
    };

    const rendered = renderLoginDemoUI(isDemo);
    assert.strictEqual(rendered.includes('Trải nghiệm Demo'), false);
    assert.strictEqual(rendered.includes('Danh sách tài khoản Demo'), false);
  });

  await t.test('fail-closed: network error / timeout returns false', async () => {
    let fetchCalls = 0;
    const failingFetcher = async () => {
      fetchCalls++;
      throw new Error('Network timeout / connection refused');
    };

    const isDemo = await loadDemoModeOnce(failingFetcher);
    assert.strictEqual(isDemo, false);
    assert.strictEqual(getCachedDemoMode(), false);
    assert.strictEqual(fetchCalls, 1);

    // UI simulation check
    const demoBannerShown = isDemo === true;
    assert.strictEqual(demoBannerShown, false);
  });

  await t.test('fail-closed: malformed or non-boolean values return false', async () => {
    for (const invalidValue of ['true', 1, null, undefined, {}]) {
      resetDemoModeCache();
      const isDemo = await loadDemoModeOnce(async () => ({ data: { demo: invalidValue as any } }));
      assert.strictEqual(isDemo, false, `Expected false for ${JSON.stringify(invalidValue)}`);
    }
  });

  await t.test('success: meta { demo: true } returns true (shows demo text)', async () => {
    let fetchCalls = 0;
    const mockFetcher = async () => {
      fetchCalls++;
      return { data: { demo: true } };
    };

    const isDemo = await loadDemoModeOnce(mockFetcher);
    assert.strictEqual(isDemo, true);
    assert.strictEqual(getCachedDemoMode(), true);
    assert.strictEqual(fetchCalls, 1);

    // Verify UI simulation: when isDemo is true, demo text must appear
    const renderLoginDemoUI = (demoActive: boolean) => {
      const elements: string[] = [];
      if (demoActive) {
        elements.push('Trải nghiệm Demo? Chọn tài khoản mẫu');
        elements.push('Danh sách tài khoản Demo');
      }
      return elements.join(' | ');
    };

    const rendered = renderLoginDemoUI(isDemo);
    assert.strictEqual(rendered.includes('Trải nghiệm Demo'), true);
    assert.strictEqual(rendered.includes('Danh sách tài khoản Demo'), true);
  });

  await t.test('deduplication & cache: multiple calls execute fetcher exactly once', async () => {
    let fetchCalls = 0;
    const mockFetcher = async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 10));
      return { data: { demo: true } };
    };

    // Parallel calls while in-flight
    const [res1, res2, res3] = await Promise.all([
      loadDemoModeOnce(mockFetcher),
      loadDemoModeOnce(mockFetcher),
      loadDemoModeOnce(mockFetcher),
    ]);

    assert.strictEqual(res1, true);
    assert.strictEqual(res2, true);
    assert.strictEqual(res3, true);
    assert.strictEqual(fetchCalls, 1, 'Fetcher must be called exactly once');

    // Subsequent call uses cached value
    const res4 = await loadDemoModeOnce(mockFetcher);
    assert.strictEqual(res4, true);
    assert.strictEqual(fetchCalls, 1, 'Subsequent call must use cached value without fetching');
  });
});
