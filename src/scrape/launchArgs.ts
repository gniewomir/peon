const UNSAFE_FLAG_NAMES = new Set(['no-sandbox', 'disable-setuid-sandbox']);

function argDisablesSandbox(arg: string): boolean {
  if (arg === '--no-sandbox' || arg === '--disable-setuid-sandbox') {
    return true;
  }
  if (arg.startsWith('--no-sandbox=') || arg.startsWith('--disable-setuid-sandbox=')) {
    return true;
  }
  if (arg.startsWith('--') && arg.includes('=')) {
    const name = arg.slice(2).split('=')[0];
    if (name) {
      return UNSAFE_FLAG_NAMES.has(name);
    }
  }
  return false;
}

/**
 * Refuses Chromium flags that disable the sandbox unless PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1.
 */
export function assertLaunchArgsSafe(args: string[]): void {
  const unsafe = args.filter(argDisablesSandbox);
  if (unsafe.length === 0) {
    return;
  }
  if (process.env.PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX === '1') {
    console.warn(
      'peon scrape: PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1 — launching with sandbox-disabling flags:',
      unsafe.join(', '),
    );
    return;
  }
  throw new Error(
    `Refusing Chromium args that disable sandbox: ${unsafe.join(', ')}. ` +
      'Fix the host environment (e.g. non-root Docker, user namespaces), or set PEON_SCRAPER_ALLOW_UNSAFE_SANDBOX=1 if you accept the risk.',
  );
}
