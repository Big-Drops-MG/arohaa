import bcrypt from "bcryptjs"

export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "__arohaa_timing_dummy_not_a_password__",
  12
)
