import { BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import { DEFAULT_TENANT_CONTEXT, TenantContext } from "../tenant-context";
import { TenantResolver } from "../tenant-resolver.interface";
import { TenantContextMiddleware } from "../tenant-context.middleware";

describe("TenantContextMiddleware", () => {
  const originalEnvStrict = process.env.TENANCY_STRICT;

  afterEach(() => {
    if (originalEnvStrict === undefined) {
      delete process.env.TENANCY_STRICT;
    } else {
      process.env.TENANCY_STRICT = originalEnvStrict;
    }
    jest.clearAllMocks();
  });

  describe("Strict mode + Unresolved tenant", () => {
    it("strict + resolver returns undefined + path /api/customers -> handler does not run, receives TENANT_NOT_RESOLVED error", async () => {
      process.env.TENANCY_STRICT = "true";
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(undefined),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/customers",
        originalUrl: "/api/customers",
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe("TENANT_NOT_RESOLVED");
      expect((err as any).code).toBe("TENANT_NOT_RESOLVED");
      expect(err.getStatus()).toBe(400);
      expect(TenantContext.getStore()).toBeUndefined();
    });

    it("strict + resolver returns null + path /api/customers -> handler does not run, receives TENANT_NOT_RESOLVED error", async () => {
      process.env.TENANCY_STRICT = "true";
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(null),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/customers",
        originalUrl: "/api/customers",
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe("TENANT_NOT_RESOLVED");
      expect(TenantContext.getStore()).toBeUndefined();
    });
  });

  describe("Non-health paths ending with /health are not treated as health", () => {
    it("strict + resolver throws error + path /api/projects/health -> handler does not run (not treated as health)", async () => {
      process.env.TENANCY_STRICT = "true";
      const expectedError = new Error("Database lookup failed");
      const resolver: TenantResolver = {
        resolve: jest.fn().mockRejectedValue(expectedError),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/projects/health",
        originalUrl: "/api/projects/health",
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expectedError);
      expect(TenantContext.getStore()).toBeUndefined();
    });

    it("strict + resolver returns undefined + path /api/projects/health -> receives TENANT_NOT_RESOLVED error", async () => {
      process.env.TENANCY_STRICT = "true";
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(undefined),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/projects/health",
        originalUrl: "/api/projects/health",
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe("TENANT_NOT_RESOLVED");
    });
  });

  describe("Exact health paths fallback to default tenant context", () => {
    it.each([
      ["/api/health", "/api/health"],
      ["/api/health/", "/api/health/"],
      ["/api/health?x=1", "/api/health?x=1"],
      ["/health", "/health"],
      ["/health/", "/health/"],
      ["/health?x=1", "/health?x=1"],
    ])(
      "strict + path %s -> runs under default tenant context",
      async (_name, rawPath) => {
        process.env.TENANCY_STRICT = "true";
        const resolver: TenantResolver = {
          resolve: jest.fn().mockResolvedValue(undefined),
        };
        const middleware = new TenantContextMiddleware(resolver);
        const req = {
          path: rawPath,
          originalUrl: rawPath,
        } as Request;
        const res = {} as Response;

        let capturedContext: any = null;
        const next = jest.fn(() => {
          capturedContext = TenantContext.current();
        });

        middleware.use(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
        expect(capturedContext).toEqual(DEFAULT_TENANT_CONTEXT);
      },
    );

    it("strict + health route + resolver throws -> falls back to default tenant context", async () => {
      process.env.TENANCY_STRICT = "true";
      const resolver: TenantResolver = {
        resolve: jest.fn().mockRejectedValue(new Error("Resolver failed")),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/health",
        originalUrl: "/api/health",
      } as Request;
      const res = {} as Response;

      let capturedContext: any = null;
      const next = jest.fn(() => {
        capturedContext = TenantContext.current();
      });

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(capturedContext).toEqual(DEFAULT_TENANT_CONTEXT);
    });
  });

  describe("Non-strict mode (preserves demo)", () => {
    it("not strict + resolver returns undefined -> runs under default tenant context", async () => {
      process.env.TENANCY_STRICT = "false";
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(undefined),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/customers",
        originalUrl: "/api/customers",
      } as Request;
      const res = {} as Response;

      let capturedContext: any = null;
      const next = jest.fn(() => {
        capturedContext = TenantContext.current();
      });

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(capturedContext).toEqual(DEFAULT_TENANT_CONTEXT);
    });

    it("env unset + resolver returns undefined -> runs under default tenant context", async () => {
      delete process.env.TENANCY_STRICT;
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(undefined),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/customers",
        originalUrl: "/api/customers",
      } as Request;
      const res = {} as Response;

      let capturedContext: any = null;
      const next = jest.fn(() => {
        capturedContext = TenantContext.current();
      });

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(capturedContext).toEqual(DEFAULT_TENANT_CONTEXT);
    });
  });

  describe("Resolved tenant context", () => {
    it("runs under resolved tenant context when resolver returns a tenant", async () => {
      process.env.TENANCY_STRICT = "true";
      const customTenant = {
        tenantId: "tenant_custom",
        schema: "tenant_custom",
      };
      const resolver: TenantResolver = {
        resolve: jest.fn().mockResolvedValue(customTenant),
      };
      const middleware = new TenantContextMiddleware(resolver);
      const req = {
        path: "/api/customers",
        originalUrl: "/api/customers",
      } as Request;
      const res = {} as Response;

      let capturedContext: any = null;
      const next = jest.fn(() => {
        capturedContext = TenantContext.current();
      });

      middleware.use(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(capturedContext).toEqual(customTenant);
    });
  });
});
