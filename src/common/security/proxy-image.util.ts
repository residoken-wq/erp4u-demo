import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';

const DEFAULT_ALLOWED_HOSTS = ['drive.google.com', 'lh3.googleusercontent.com'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Check whether an IP string is loopback, private, link-local, or cloud metadata.
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true;

  // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const targetIp = ipv4Mapped ? ipv4Mapped[1] : ip;

  const version = net.isIP(targetIp);
  if (version === 4) {
    const parts = targetIp.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b] = parts;
    // 0.0.0.0/8
    if (a === 0) return true;
    // Loopback: 127.0.0.0/8
    if (a === 127) return true;
    // Private RFC 1918: 10.0.0.0/8
    if (a === 10) return true;
    // Private RFC 1918: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // Private RFC 1918: 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local & cloud metadata: 169.254.0.0/16
    if (a === 169 && b === 254) return true;
    // Broadcast / future
    if (a >= 224) return true;
    return false;
  }

  if (version === 6) {
    const lower = targetIp.toLowerCase();
    // Loopback: ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified: ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique Local: fc00::/7 (starts with fc or fd)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-Local: fe80::/10 (starts with fe8, fe9, fea, feb)
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }
    return false;
  }

  return true;
}

export function getAllowedHosts(): Set<string> {
  const allowed = new Set<string>(DEFAULT_ALLOWED_HOSTS.map((h) => h.toLowerCase()));
  if (process.env.PROXY_IMAGE_ALLOWED_HOSTS) {
    const envHosts = process.env.PROXY_IMAGE_ALLOWED_HOSTS.split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    envHosts.forEach((h) => allowed.add(h));
  }
  return allowed;
}

/**
 * Handle proxy-image request with full SSRF and resource consumption protections.
 */
export async function handleProxyImage(url: string, res: Response): Promise<void> {
  if (!url || typeof url !== 'string') {
    throw new BadRequestException('Tham số URL không hợp lệ');
  }

  const trimmed = url.trim();

  // 1. Local upload path: /uploads/...
  if (trimmed.startsWith('/uploads/')) {
    const safePath = path.normalize(trimmed).replace(/^(\.\.[\/\\])+/, '');
    if (safePath.includes('..')) {
      throw new BadRequestException('Đường dẫn không hợp lệ');
    }
    const relativePath = safePath.replace(/^\/?uploads\/?/, '');
    const fullPath = path.join(process.cwd(), 'uploads', relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Tệp không tồn tại');
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile() || stat.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Tệp vượt quá kích thước cho phép');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(fullPath).pipe(res);
    return;
  }

  // 2. External URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new BadRequestException('Định dạng URL không hợp lệ');
  }

  // Protocol check: https only
  if (parsedUrl.protocol !== 'https:') {
    throw new BadRequestException('Chỉ cho phép giao thức HTTPS');
  }

  // Host allowlist check
  const allowedHosts = getAllowedHosts();
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!allowedHosts.has(hostname)) {
    throw new BadRequestException(`Host '${hostname}' không nằm trong allowlist được phép`);
  }

  // DNS resolution & SSRF IP check
  let addresses: dns.LookupAddress[] = [];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err: any) {
    throw new BadRequestException(`Không thể phân giải DNS cho host '${hostname}': ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new BadRequestException('Không tìm thấy địa chỉ IP cho host');
  }

  for (const addr of addresses) {
    if (isPrivateOrLoopbackIp(addr.address)) {
      throw new BadRequestException(`Truy cập địa chỉ IP không được phép: ${addr.address}`);
    }
  }

  // Fetch image: manual redirect, 10s timeout, max 10MB
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(trimmed, {
      method: 'GET',
      redirect: 'manual', // DO NOT FOLLOW REDIRECTS
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Reject redirects (3xx) and non-200
    if (response.status !== 200) {
      throw new BadRequestException(`Không thể tải ảnh, HTTP status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new BadRequestException(`Nội dung không phải là ảnh: ${contentType}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Ảnh vượt quá dung lượng tối đa 10 MB');
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Ảnh vượt quá dung lượng tối đa 10 MB');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      throw err;
    }
    throw new BadRequestException(`Lỗi khi tải ảnh: ${err.message}`);
  }
}
