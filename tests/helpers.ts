/** Shared test utilities for mocking fetch and localStorage */

// Mock localStorage
export const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true })

// Track fetch calls
export const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
export const originalFetch = globalThis.fetch

/** Reset all mocks — call this in each test file's beforeEach */
export function resetMocks() {
  storage.clear()
  fetchCalls.length = 0
  globalThis.fetch = originalFetch
}

export function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mockFn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    fetchCalls.push({ url, init })
    return handler(url, init)
  }
  ;(mockFn as any).preconnect = () => {}
  globalThis.fetch = mockFn as typeof fetch
}
