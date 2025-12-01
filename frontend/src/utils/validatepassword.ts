export interface PasswordValidationResult {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export function validatePassword(password: string): PasswordValidationResult {
  return {
    length: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
}

export function isPasswordStrong(result: PasswordValidationResult): boolean {
  return Object.values(result).every(Boolean);
}
