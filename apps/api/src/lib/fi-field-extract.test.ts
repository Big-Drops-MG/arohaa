import { describe, expect, it } from 'vitest'
import {
  extractFieldsFromFiMessage,
  extractFieldsFromFiPayload,
  mergeFieldMaps,
} from './fi-field-extract.js'

describe('extractFieldsFromFiMessage', () => {
  it('parses changed / selected Event Log messages', () => {
    const into: Record<string, string> = {}
    const typed = new Map<string, string>()
    extractFieldsFromFiMessage(
      'changed value to "Ada" in [first_name]',
      into,
      typed,
    )
    extractFieldsFromFiMessage(
      'changed value to "ada@example.com" in [email]',
      into,
      typed,
    )
    extractFieldsFromFiMessage('selected "Yes" in [insured]', into, typed)
    expect(into).toEqual({
      first_name: 'Ada',
      email: 'ada@example.com',
      insured: 'Yes',
    })
  })

  it('accumulates typed characters when no changed message exists', () => {
    const payload = {
      v: 1,
      i: [
        { m: "typed 'a' in [email]" },
        { m: "typed 'd' in [email]" },
        { m: "typed 'a' in [email]" },
        { m: "typed '@' in [email]" },
        { m: "typed 'x' in [email]" },
        { m: "pressed 'Control+v' in [email]" },
      ],
    }
    expect(extractFieldsFromFiPayload(payload).email).toBe('ada@x')
  })

  it('prefers changed value over typed buffer', () => {
    expect(
      extractFieldsFromFiPayload({
        i: [
          { m: "typed 'a' in [email]" },
          { m: 'changed value to "final@ex.com" in [email]' },
        ],
      }).email,
    ).toBe('final@ex.com')
  })
})

describe('mergeFieldMaps', () => {
  it('fills gaps from later maps without wiping earlier values when empty', () => {
    expect(
      mergeFieldMaps(
        { email: 'a@b.com', first_name: 'Ada' },
        { email: 'newer@b.com', zip: '10001' },
      ),
    ).toEqual({
      email: 'newer@b.com',
      first_name: 'Ada',
      zip: '10001',
    })
  })
})
