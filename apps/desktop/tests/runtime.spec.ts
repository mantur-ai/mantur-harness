/** Desktop dsh child-process contract. */

import { describe, expect, it } from 'vitest'
import { buildDshArguments, extractReadyUrl } from '../src/runtime.ts'

describe('desktop runtime', () => {
  it('launches only the existing loopback Web profile', () => {
    expect(buildDshArguments('/app/dsh/lib/bin.js')).toEqual([
      '--expose-internals',
      '/app/dsh/lib/bin.js',
      '--profile',
      'web',
      '--host',
      '127.0.0.1',
      '--port',
      '0',
      '--no-open',
    ])
  })

  it('accepts only a tokenized loopback readiness URL', () => {
    expect(extractReadyUrl('dsh web: http://127.0.0.1:4312/?token=secret-value\n')).toBe(
      'http://127.0.0.1:4312/?token=secret-value',
    )
    expect(extractReadyUrl('dsh web: http://192.168.1.3:4312/?token=secret-value\n')).toBeUndefined()
    expect(extractReadyUrl('dsh web: http://127.0.0.1:4312/\n')).toBeUndefined()
  })
})
