import { isPrivateOrLoopbackIp, handleProxyImage, getAllowedHosts } from '../proxy-image.util';
import { BadRequestException } from '@nestjs/common';

describe('Proxy Image Security (SSRF Protection)', () => {
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

  describe('handleProxyImage', () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    it('rejects missing or empty URL with 400', async () => {
      await expect(handleProxyImage('', mockRes)).rejects.toThrow(BadRequestException);
      await expect(handleProxyImage(null as any, mockRes)).rejects.toThrow(BadRequestException);
    });

    it('rejects non-https protocol with 400', async () => {
      await expect(handleProxyImage('http://127.0.0.1/test.png', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(handleProxyImage('http://169.254.169.254/latest/meta-data', mockRes)).rejects.toThrow(
        BadRequestException,
      );
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

    it('rejects path traversal on /uploads with 400', async () => {
      await expect(handleProxyImage('/uploads/../../etc/passwd', mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
