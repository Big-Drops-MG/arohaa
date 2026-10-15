import { describe, expect, it } from 'vitest'
import {
  detectClipboardFromFiMessage,
  detectClipboardFromFiPayload,
} from './fi-clipboard.js'

describe('detectClipboardFromFiMessage', () => {
  it('detects Control+v / Control+c pressed messages', () => {
    expect(
      detectClipboardFromFiMessage("pressed 'Control+v' in [email]"),
    ).toEqual({ usedCopy: false, usedPaste: true })
    expect(
      detectClipboardFromFiMessage("pressed 'Control+c' in [first_name]"),
    ).toEqual({ usedCopy: true, usedPaste: false })
  })

  it('detects pasted / copied verbs', () => {
    expect(detectClipboardFromFiMessage('pasted in [email]')).toEqual({
      usedCopy: false,
      usedPaste: true,
    })
    expect(detectClipboardFromFiMessage('copied in [email]')).toEqual({
      usedCopy: true,
      usedPaste: false,
    })
  })
})

describe('detectClipboardFromFiPayload', () => {
  it('scans sealed FI item arrays', () => {
    expect(
      detectClipboardFromFiPayload({
        v: 1,
        i: [
          { t: 1, k: 1, m: "typed 'a' in [email]" },
          { t: 2, k: 1, m: "pressed 'Control+v' in [email]" },
        ],
      }),
    ).toEqual({ usedCopy: false, usedPaste: true })
  })
})
