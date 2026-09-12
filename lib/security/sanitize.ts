/**
 * Strip null bytes and control characters from user input.
 * Does NOT sanitize HTML — use a dedicated library if rendering HTML.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, '')           // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .trim()
}
