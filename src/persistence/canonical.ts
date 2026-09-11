export function canonicalState(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function hashState(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalState(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize((value as Record<string, unknown>)[key])]));
  }
  return value;
}
