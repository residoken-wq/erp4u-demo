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
  return allowedOrigins.includes(origin);
}
