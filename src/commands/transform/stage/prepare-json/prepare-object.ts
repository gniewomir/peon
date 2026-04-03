export function requireObject(
  input: unknown,
  context: { strategy: string; filePath: string },
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(
      `Invalid raw job payload for strategy "${context.strategy}" in "${context.filePath}"`,
    );
  }
  return input as Record<string, unknown>;
}
