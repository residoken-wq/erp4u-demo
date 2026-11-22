import { PublicController } from '../public.controller';
import { DemoModeService } from '../../common/services/demo-mode.service';

describe('PublicController GET /public/meta demo mode flag (Task P7c6b)', () => {
  it('returns demo: true when DEMO_MODE=true', async () => {
    const configService = {
      get: (key: string) => (key === 'DEMO_MODE' ? 'true' : null),
    } as any;
    const demoModeService = new DemoModeService(configService);
    const controller = new PublicController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      demoModeService
    );

    const meta = await controller.getMeta();
    expect(meta).toEqual({
      demo: true,
      version: '1.0.0',
    });
  });

  it('returns demo: false when DEMO_MODE=false (Production SaaS)', async () => {
    const configService = {
      get: (key: string) => (key === 'DEMO_MODE' ? 'false' : null),
    } as any;
    const demoModeService = new DemoModeService(configService);
    const controller = new PublicController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      demoModeService
    );

    const meta = await controller.getMeta();
    expect(meta).toEqual({
      demo: false,
      version: '1.0.0',
    });
  });

  it('returns demo: false by default when DEMO_MODE is not configured', async () => {
    const configService = {
      get: () => null,
    } as any;
    const demoModeService = new DemoModeService(configService);
    const controller = new PublicController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      demoModeService
    );

    const meta = await controller.getMeta();
    expect(meta).toEqual({
      demo: false,
      version: '1.0.0',
    });
  });
});
