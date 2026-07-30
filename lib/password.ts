/** Shared password rules for register + reset-password UI. */

export const PASSWORD_MIN_LENGTH = 8

export type PasswordRuleKey = "length" | "upper" | "symbol"

export type PasswordRule = {
  key: PasswordRuleKey
  label: string
  ok: boolean
}

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    {
      key: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      key: "upper",
      label: "One uppercase letter",
      ok: /[A-Z]/.test(password),
    },
    {
      key: "symbol",
      label: "One symbol (e.g. !@#$%)",
      ok: /[^A-Za-z0-9]/.test(password),
    },
  ]
}

export function validatePassword(password: string): string | null {
  const failed = getPasswordRules(password).find((r) => !r.ok)
  if (!failed) return null
  if (failed.key === "length") {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (failed.key === "upper") {
    return "Password must include at least one uppercase letter."
  }
  return "Password must include at least one symbol (e.g. !@#$%)."
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null
}
