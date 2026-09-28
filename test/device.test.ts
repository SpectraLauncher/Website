import { describe, expect, it } from 'vitest'
import { describeAgent } from '../app/utils/device'

describe('session device labels', () => {
  it('names new launcher sessions by operating system', () => {
    expect(describeAgent('Spectra-Launcher/0.8.2 (Windows)')).toBe('Spectra Launcher · Windows')
    expect(describeAgent('Spectra-Launcher/0.8.2 (macOS)')).toBe('Spectra Launcher · macOS')
    expect(describeAgent('Spectra-Launcher/0.8.2 (Linux)')).toBe('Spectra Launcher · Linux')
  })

  it('recognises sessions from older launcher versions', () => {
    expect(describeAgent('Spectra-Launcher/0.8.1')).toBe('Spectra Launcher')
  })

  it('keeps browser sessions recognisable', () => {
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'))
      .toBe('Chrome · Windows')
  })
})
