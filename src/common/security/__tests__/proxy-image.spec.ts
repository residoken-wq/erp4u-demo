import {
  isPrivateOrLoopbackIp,
  handleProxyImage,
  getAllowedHosts,
  isHostAllowed,
} from '../proxy-image.util';
import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns';

describe('Proxy Image Security (SSRF Protection & Uploads Hardening)', () => {
  describe('isPrivateOrLoopbackIp', () => {
    it('detects IPv4 loopback addresses', () => {
      expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('127.0.1.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('127.255.255.255')).toBe(true);
    });

    it('detects IPv4 cloud metadata & link-local', () => {
      expect(isPrivateOrLoopbackIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrLoopbackIp('169.254.1.1')).toBe(true);
    });

    it('detects IPv4 RFC 1918 private addresses', () => {
      expect(isPrivateOrLoopbackIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('10.255.255.255')).toBe(true);
      expect(isPrivateOrLoopbackIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrLoopbackIp('192.168.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('192.168.255.255')).toBe(true);
    });

    it('detects IPv6 loopback, link-local, and unique-local addresses', () => {
      expect(isPrivateOrLoopbackIp('::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('fe80::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('fc00::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('::ffff:169.254.169.254')).toBe(true);
    });

    it('allows public IP addresses', () => {
      expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrLoopbackIp('142.250.190.46')).toBe(false);
      expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);
    });
  });

  describe('isHostAllowed with dot boundary', () => {
    it('matches allowed hosts and wildcards on dot boundary strictly', () => {
      const patterns = ['drive.google.com', 'lh3.googleusercontent.com', '*.googleusercontent.com'];
      expect(isHostAllowed('drive.google.com', patterns)).toBe(true);
      expect(isHostAllowed('lh3.googleusercontent.com', patterns)).toBe(true);
      expect(isHostAllowed('googleusercontent.com', patterns)).toBe(true);
      expect(isHostAllowed('images.googleusercontent.com', patterns)).toBe(true);
      expect(isHostAllowed('sub.domain.googleusercontent.com', patterns)).toBe(true);

      // Must NOT match non-dot suffix boundaries
      expect(isHostAllowed('evilgoogleusercontent.com', patterns)).toBe(false);
      expect(isHostAllowed('notgoogleusercontent.com', patterns)).toBe(false);
      expect(isHostAllowed('drive.google.com.attacker.com', patterns)).toBe(false);
      expect(isHostAllowed('attacker.com', patterns)).toBe(false);
    });
  });

  describe('handleProxyImage - /uploads security', () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    it('rejects /uploads/private/ai-scans/x.png with 400', async () => {
      await expect(handleProxyImage('/uploads/private/ai-scans/x.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects url-encoded /uploads/%70rivate/x.png with 400', async () => {
      await expect(handleProxyImage('/uploads/%70rivate/x.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects path-traversal /uploads/a/../private/x.png with 400', async () => {
      await expect(handleProxyImage('/uploads/a/../private/x.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects non-image extension /uploads/doc.pdf with 400', async () => {
      await expect(handleProxyImage('/uploads/doc.pdf', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects path traversal on /uploads with 400', async () => {
      await expect(handleProxyImage('/uploads/../../etc/passwd', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects missing or empty URL with 400', async () => {
      await expect(handleProxyImage('', mockRes)).rejects.toThrow(BadRequestException);
      await expect(handleProxyImage(null as any, mockRes)).rejects.toThrow(BadRequestException);
    });

    it('rejects non-https protocol with 400', async () => {
      await expect(handleProxyImage('http://127.0.0.1/test.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        handleProxyImage('http://169.254.169.254/latest/meta-data', mockRes),
      ).rejects.toThrow(BadRequestException);
      await expect(handleProxyImage('ftp://drive.google.com/pic.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects hosts not in allowlist with 400', async () => {
      await expect(handleProxyImage('https://evil.com/image.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handleProxyImage('https://localhost/image.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handleProxyImage('https://127.0.0.1/image.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleProxyImage - external redirects and streaming', () => {
    let originalFetch: typeof global.fetch;
    let originalLookup: typeof dns.promises.lookup;

    beforeEach(() => {
      originalFetch = global.fetch;
      originalLookup = dns.promises.lookup;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      dns.promises.lookup = originalLookup;
    });

    it('follows valid redirect from drive.google.com to *.googleusercontent.com and succeeds (200)', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      dns.promises.lookup = jest.fn().mockImplementation((hostname: string) => {
        return Promise.resolve([{ address: '142.250.190.46', family: 4 }]);
      }) as any;

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({
            location: 'https://lh3.googleusercontent.com/thumbnail-data',
          }),
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Headers({
            'content-type': 'image/jpeg',
            'content-length': '4',
          }),
          body: mockBody,
        } as any);

      await handleProxyImage('https://drive.google.com/thumbnail?id=123', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('rejects redirect to host outside allowlist with 400', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      dns.promises.lookup = jest.fn().mockResolvedValue([{ address: '142.250.190.46', family: 4 }]) as any;

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 302,
        headers: new Headers({
          location: 'https://evil.example.com/malicious.png',
        }),
      } as any);

      await expect(
        handleProxyImage('https://drive.google.com/thumbnail?id=123', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects redirect to private/loopback IP with 400', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      let callCount = 0;
      dns.promises.lookup = jest.fn().mockImplementation((hostname: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ address: '142.250.190.46', family: 4 }]);
        }
        return Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
      }) as any;

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 302,
        headers: new Headers({
          location: 'https://lh3.googleusercontent.com/private-target.png',
        }),
      } as any);

      await expect(
        handleProxyImage('https://drive.google.com/thumbnail?id=123', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when redirects exceed 3 with 400', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      dns.promises.lookup = jest.fn().mockResolvedValue([{ address: '142.250.190.46', family: 4 }]) as any;

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({ location: 'https://lh3.googleusercontent.com/r1' }),
        } as any)
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({ location: 'https://lh3.googleusercontent.com/r2' }),
        } as any)
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({ location: 'https://lh3.googleusercontent.com/r3' }),
        } as any)
        .mockResolvedValueOnce({
          status: 302,
          headers: new Headers({ location: 'https://lh3.googleusercontent.com/r4' }),
        } as any);

      await expect(
        handleProxyImage('https://drive.google.com/thumbnail?id=123', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('aborts stream when response exceeds 10 MB and throws 400', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      dns.promises.lookup = jest.fn().mockResolvedValue([{ address: '142.250.190.46', family: 4 }]) as any;

      // Stream emitting 6MB chunks, exceeding 10MB on second chunk
      const chunk6MB = new Uint8Array(6 * 1024 * 1024);
      let count = 0;
      const mockBody = new ReadableStream({
        pull(controller) {
          if (count < 3) {
            count++;
            controller.enqueue(chunk6MB);
          } else {
            controller.close();
          }
        },
      });

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        headers: new Headers({
          'content-type': 'image/jpeg',
          // No content-length header
        }),
        body: mockBody,
      } as any);

      await expect(
        handleProxyImage('https://lh3.googleusercontent.com/large.jpg', mockRes),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
