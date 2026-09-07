import { describe, expect, it } from 'vitest'

import { describeAgent } from '../../app/utils/device'

describe('describeAgent', () => {
  it('rozpoznaje przegladarke i system', () => {
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'))
      .toBe('Chrome · Windows')

    expect(describeAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'))
      .toBe('Safari · macOS')

    expect(describeAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'))
      .toBe('Firefox · Linux')
  })

  // Edge and Opera both put Chrome in their agent, so the order of the table is
  // the whole behaviour. This is also what a broken regex literal breaks first.
  it('nie myli Edge ani Opery z Chrome', () => {
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'))
      .toBe('Edge · Windows')

    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 OPR/119.0.0.0'))
      .toBe('Opera · Windows')
  })

  it('rozpoznaje telefony', () => {
    expect(describeAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'))
      .toBe('Safari · iOS')

    expect(describeAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'))
      .toBe('Chrome · Android')
  })

  it('zwraca null, kiedy nie ma czego nazwac', () => {
    expect(describeAgent(null)).toBeNull()
    expect(describeAgent('')).toBeNull()
    expect(describeAgent('curl/8.7.1')).toBeNull()
  })
})
