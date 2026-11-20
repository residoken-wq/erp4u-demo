import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { RbacGuard } from '../rbac.guard';
import { JwtStrategy } from '../jwt.strategy';
import { getJwtSecret, _resetSecretsStateForTesting } from '../../common/security/secrets';

describe('JWT Secret Security (SEC-1)', () => {
  const origEnv = process.env;
  const SECRET_A = 'custom-configured-jwt-secret-value-A-min-32-chars';
  const LEGACY_HARDCODED_KEY = 'ERP4U_SECRET_KEY';

  let jwtService: JwtService;
  let authService: AuthService;
  let rbacGuard: RbacGuard;
  let jwtStrategy: JwtStrategy;

  beforeEach(() => {
    process.env = { ...origEnv };
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = SECRET_A;
    _resetSecretsStateForTesting();

    // JwtService configured with the dynamic secret from getJwtSecret()
    jwtService = new JwtService({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '1d' },
    });

    const mockUsersService = {
      findOneByUsernameForAuth: jest.fn().mockResolvedValue({
        id: 1,
        username: 'admin',
        full_name: 'Admin User',
        group: { id: 1, name: 'Admin', permissions: [] },
      }),
    };

    authService = new AuthService(mockUsersService as any, jwtService);

    const reflector = new Reflector();
    const mockRbacModeService = { get: jest.fn().mockResolvedValue('ENFORCE') };
    const mockAccessLogService = { record: jest.fn().mockResolvedValue(undefined) };
    const mockPermCacheService = { hasAny: jest.fn().mockResolvedValue(true) };

    rbacGuard = new RbacGuard(
      reflector,
      jwtService,
      mockRbacModeService as any,
      mockAccessLogService as any,
      mockPermCacheService as any,
    );

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => process.env[key]),
    };
    jwtStrategy = new JwtStrategy(mockConfigService as any);
  });

  afterAll(() => {
    process.env = origEnv;
    _resetSecretsStateForTesting();
  });

  function createMockContext(token?: string): ExecutionContext {
    const req: any = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      method: 'GET',
      baseUrl: '/api/admin',
      url: '/api/admin',
      connection: { remoteAddress: '127.0.0.1' },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('rejects token signed with legacy hardcoded key via RbacGuard, jwtService.verify, and JwtStrategy', async () => {
    // Generate token signed with legacy key
    const legacyJwtService = new JwtService({ secret: LEGACY_HARDCODED_KEY });
    const legacyToken = legacyJwtService.sign({
      sub: 1,
      username: 'admin',
      group_id: 1,
    });

    // 1. jwtService.verify MUST throw invalid signature
    expect(() => jwtService.verify(legacyToken)).toThrow();

    // 2. RbacGuard in ENFORCE mode MUST throw UnauthorizedException
    const context = createMockContext(legacyToken);
    await expect(rbacGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    // 3. JwtStrategy authenticate MUST fail on legacy token
    const mockReq = { headers: { authorization: `Bearer ${legacyToken}` } };
    let failed = false;
    (jwtStrategy as any).fail = () => { failed = true; };
    (jwtStrategy as any).error = () => { failed = true; };
    (jwtStrategy as any).success = () => { failed = false; };
    (jwtStrategy as any).authenticate(mockReq);
    expect(failed).toBe(true);
  });

  it('accepts token issued by AuthService via both RbacGuard and JwtStrategy', async () => {
    // Generate token from AuthService with SECRET_A
    const loginResult = await authService.login({
      id: 1,
      username: 'admin',
      full_name: 'Admin User',
      group: { id: 1, name: 'Admin' },
    });
    const validToken = loginResult.access_token;
    expect(validToken).toBeDefined();

    // 1. jwtService.verify accepts and returns correct payload
    const decoded = jwtService.verify(validToken);
    expect(decoded.username).toBe('admin');
    expect(decoded.sub).toBe(1);

    // 2. RbacGuard in ENFORCE mode allows access
    const context = createMockContext(validToken);
    const canActivateResult = await rbacGuard.canActivate(context);
    expect(canActivateResult).toBe(true);

    // 3. JwtStrategy uses the SAME secret and validates the payload
    let resolvedSecret = '';
    (jwtStrategy as any)._secretOrKeyProvider(null, null, (_err: any, secret: string) => {
      resolvedSecret = secret;
    });
    expect(resolvedSecret).toBe(SECRET_A);
    expect(resolvedSecret).not.toBe(LEGACY_HARDCODED_KEY);

    // Authenticate via passport JwtStrategy
    const mockReq = { headers: { authorization: `Bearer ${validToken}` } };
    let authenticatedUser: any = null;
    (jwtStrategy as any).success = (user: any) => { authenticatedUser = user; };
    (jwtStrategy as any).fail = () => { authenticatedUser = null; };
    (jwtStrategy as any).error = () => { authenticatedUser = null; };
    (jwtStrategy as any).authenticate(mockReq);

    const validatedUser = await jwtStrategy.validate(decoded);
    expect(validatedUser).toEqual({
      id: 1,
      userId: 1,
      username: 'admin',
      full_name: 'Admin User',
      groupId: 1,
    });
  });
});
