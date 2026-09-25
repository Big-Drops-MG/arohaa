const XOR = 0x5a

function d(encoded: string): string {
  const bin = atob(encoded)
  let out = ""
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ XOR)
  }
  return out
}

export const FI_EV = d("BTwz")

export const FI_PROP = d("BTE=")

export const FI_MSG = {
  typed: d("LiMqPz4="),
  pressed: d("Kig/KSk/Pg=="),
  clickedOn: d("OTYzOTE/Pno1NA=="),
  changedTo: d("OTI7ND0/PnosOzYvP3ouNQ=="),
  selected: d("KT82PzkuPz4="),
  formStarted: d("PDUoN3opLjsoLj8+"),
  formSubmitted: d("PDUoN3opLzg3My4uPz4="),
  formCompleted: d("PDUoN3o5NTcqNj8uPz4="),
  step: d("KS4/Kg=="),
  viewed: d("LDM/LT8+"),
  completed: d("OTU3KjY/Lj8+"),
  inSep: d("ejM0eg=="),
  unnamed: d("LzQ0Ozc/Pg=="),
} as const
