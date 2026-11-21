const SUBDOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  nodeEnv: string = process.env.NODE_ENV || 'development'
): boolean {
  if (nodeEnv !== 'production') {
    return true;
  }
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes('*')) {
    return true;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  for (const pattern of allowedOrigins) {
    let patternUrl: URL;
    try {
      patternUrl = new URL(pattern.trim());
    } catch {
      continue;
    }

    if (!patternUrl.hostname.startsWith('*.')) {
      continue;
    }

    const expectedDomain = patternUrl.hostname.slice(2);
    if (!expectedDomain || expectedDomain.includes('*')) {
      continue;
    }

    // Exact scheme matching (e.g. https in pattern -> only https)
    if (originUrl.protocol !== patternUrl.protocol) {
      continue;
    }

    // Port matching: exact port when pattern specifies a port
    if (originUrl.port !== patternUrl.port) {
      continue;
    }

    // Strict domain suffix matching (exact domain after *.)
    const expectedSuffix = '.' + expectedDomain;
    if (!originUrl.hostname.endsWith(expectedSuffix)) {
      continue;
    }

    // Must match exactly one valid subdomain label (no dots, RFC 1123 label)
    const subdomain = originUrl.hostname.slice(
      0,
      originUrl.hostname.length - expectedSuffix.length
    );
    if (SUBDOMAIN_LABEL_REGEX.test(subdomain)) {
      return true;
    }
  }

  return false;
}
