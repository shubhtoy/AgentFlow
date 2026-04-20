/**
 * Key Store — thin re-export from runtime.ts for backward compatibility.
 * All key management now lives in lib/runtime.ts.
 * @deprecated Import from '@/lib/runtime' directly.
 */

import { getMode, resolveKey, getSessionKeys, setSessionKeys } from '@/lib/runtime'

export function getServerMode(): string { return getMode() === 'online' ? 'multi-user' : 'default' }
export function setServerMode(_mode: 'default' | 'multi-user') { /* no-op — mode is auto-detected */ }
export { resolveKey, getSessionKeys, setSessionKeys }
