import { configureCoreApp } from '../configure-app';

describe('configureCoreApp (Unit)', () => {
  it('applies standard core settings to express application', async () => {
    const settings: Record<string, any> = {};
    const staticAssets: Array<{ dir: string; opts: any }> = [];
    const middlewares: any[] = [];
    let corsConfig: any = null;
    let globalPrefix = '';

    const mockApp: any = {
      set: (key: string, val: any) => {
        settings[key] = val;
      },
      useStaticAssets: (dir: string, opts: any) => {
        staticAssets.push({ dir, opts });
      },
      use: (middleware: any) => {
        middlewares.push(middleware);
      },
      setGlobalPrefix: (prefix: string) => {
        globalPrefix = prefix;
      },
      enableCors: (opts: any) => {
        corsConfig = opts;
      },
    };

    await configureCoreApp(mockApp, {
      corsOrigins: ['https://example.com'],
      skipSecurityValidation: true,
      bodyLimit: '25mb',
      globalPrefix: 'api/v1',
      trustProxy: 2,
    });

    expect(settings['trust proxy']).toBe(2);
    expect(staticAssets).toHaveLength(1);
    expect(staticAssets[0].opts).toEqual({ prefix: '/uploads' });
    expect(middlewares.length).toBeGreaterThanOrEqual(2); // json & urlencoded
    expect(globalPrefix).toBe('api/v1');
    expect(corsConfig).toBeDefined();
    expect(typeof corsConfig.origin).toBe('function');
  });
});
