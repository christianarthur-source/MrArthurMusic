/**
 * Normalizes a student's name (First Name + Last Initial) so that:
 * "Alex M", "Alex M.", "alex m", "alex m.", "Alex  M." all normalize to "alex m"
 */
export function normalizeStudentName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .toLowerCase();
}

/**
 * Formats a student's display name cleanly:
 * "alex m" or "Alex M" -> "Alex M."
 */
export function formatStudentDisplayName(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const parts = trimmed.split(' ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last.length === 1 && /[a-zA-Z]/.test(last)) {
      const firstParts = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      return `${firstParts.join(' ')} ${last.toUpperCase()}.`;
    }
  }
  return trimmed.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
