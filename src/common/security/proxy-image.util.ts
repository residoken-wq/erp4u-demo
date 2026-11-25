import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';

export const DEFAULT_ALLOWED_PATTERNS = [
  'drive.google.com',
  'lh3.googleusercontent.com',
  '*.googleusercontent.com',
];
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 10000; // 10 seconds
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

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

export function getAllowedPatterns(): string[] {
  const patterns = [...DEFAULT_ALLOWED_PATTERNS];
  if (process.env.PROXY_IMAGE_ALLOWED_HOSTS) {
    const envHosts = process.env.PROXY_IMAGE_ALLOWED_HOSTS.split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    patterns.push(...envHosts);
  }
  return patterns;
}

export function getAllowedHosts(): Set<string> {
  return new Set(getAllowedPatterns());
}

/**
 * Checks whether a hostname matches the allowlist.
 * Supports exact hostname matches and wildcard prefix '*.' matching strictly on dot boundaries.
 */
export function isHostAllowed(hostname: string, patterns: string[] = getAllowedPatterns()): boolean {
  const lowerHost = hostname.toLowerCase();
  for (const pattern of patterns) {
    const lowerPat = pattern.toLowerCase();
    if (lowerPat.startsWith('*.')) {
      const suffix = lowerPat.slice(2);
      if (lowerHost === suffix || lowerHost.endsWith('.' + suffix)) {
        return true;
      }
    } else {
      if (lowerHost === lowerPat) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Handle proxy-image request with full SSRF, redirect validation, and resource consumption protections.
 */
export async function handleProxyImage(url: string, res: Response): Promise<void> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new BadRequestException('Tham số URL không hợp lệ');
  }

  const trimmed = url.trim();

  // 1. Local upload path: /uploads/...
  // Decode URL first to catch urlencoded traversal/private evasion e.g. %70rivate
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(trimmed);
  } catch {
    throw new BadRequestException('URL không hợp lệ');
  }

  const isUploadPath = trimmed.startsWith('/uploads/') || decodedUrl.startsWith('/uploads/');
  if (isUploadPath) {
    // Check path segments before and after normalization: block any 'private' segment
    const rawSegments = decodedUrl.split(/[/\\]+/).filter(Boolean);
    if (rawSegments.some((seg) => seg.toLowerCase() === 'private')) {
      throw new BadRequestException('Không được phép truy cập đường dẫn private');
    }

    const safePath = path.normalize(decodedUrl).replace(/^(\.\.[\/\\])+/, '');
    if (safePath.includes('..')) {
      throw new BadRequestException('Đường dẫn không hợp lệ');
    }

    const normSegments = safePath.split(/[/\\]+/).filter(Boolean);
    if (normSegments.some((seg) => seg.toLowerCase() === 'private')) {
      throw new BadRequestException('Không được phép truy cập đường dẫn private');
    }

    // Only allow specific image extensions
    const ext = path.extname(safePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Loại tệp không được hỗ trợ');
    }

    const relativePath = safePath.replace(/^\/?uploads\/?/, '');
    const uploadBaseDir = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.resolve(uploadBaseDir, relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Tệp không tồn tại');
    }

    // Canonicalize with realpath
    let realUploadBase: string;
    try {
      realUploadBase = fs.realpathSync(uploadBaseDir);
    } catch {
      realUploadBase = uploadBaseDir;
    }

    let realFilePath: string;
    try {
      realFilePath = fs.realpathSync(fullPath);
    } catch {
      throw new BadRequestException('Tệp không tồn tại');
    }

    // Verify real path is within uploads directory
    if (!realFilePath.startsWith(realUploadBase + path.sep) && realFilePath !== realUploadBase) {
      throw new BadRequestException('Đường dẫn không hợp lệ');
    }

    // Also check real path segments inside uploads for 'private'
    const relReal = path.relative(realUploadBase, realFilePath);
    const realSegments = relReal.split(/[/\\]+/).filter(Boolean);
    if (realSegments.some((seg) => seg.toLowerCase() === 'private')) {
      throw new BadRequestException('Không được phép truy cập đường dẫn private');
    }

    // Check canonical extension
    const realExt = path.extname(realFilePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(realExt)) {
      throw new BadRequestException('Loại tệp không được hỗ trợ');
    }

    const stat = fs.statSync(realFilePath);
    if (!stat.isFile() || stat.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Tệp vượt quá kích thước cho phép');
    }

    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[realExt] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(realFilePath).pipe(res);
    return;
  }

  // 2. External URL with redirect tracking (up to MAX_REDIRECTS)
  let currentUrl = trimmed;
  let redirectCount = 0;
  const allowedPatterns = getAllowedPatterns();

  while (true) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new BadRequestException('Định dạng URL không hợp lệ');
    }

    // Protocol check: https only
    if (parsedUrl.protocol !== 'https:') {
      throw new BadRequestException('Chỉ cho phép giao thức HTTPS');
    }

    // Host allowlist check (dot boundary matched)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (!isHostAllowed(hostname, allowedPatterns)) {
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

    // Fetch step with timeout and manual redirect handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: globalThis.Response;

    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new BadRequestException(`Lỗi khi tải ảnh: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new BadRequestException('Vượt quá số lần chuyển hướng tối đa');
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new BadRequestException('Phản hồi chuyển hướng thiếu tiêu đề Location');
      }

      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new BadRequestException('URL chuyển hướng không hợp lệ');
      }
      continue;
    }

    // Non-redirect response must be 200
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

    // Stream response body and abort immediately if exceeding MAX_IMAGE_SIZE_BYTES
    const body = response.body;
    if (!body) {
      throw new BadRequestException('Không có dữ liệu phản hồi');
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > MAX_IMAGE_SIZE_BYTES) {
            await reader.cancel();
            throw new BadRequestException('Ảnh vượt quá dung lượng tối đa 10 MB');
          }
          chunks.push(value);
        }
      }
    } catch (streamErr: any) {
      if (streamErr instanceof BadRequestException) {
        throw streamErr;
      }
      throw new BadRequestException(`Lỗi khi đọc luồng ảnh: ${streamErr.message}`);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.concat(chunks));
    return;
  }
}
