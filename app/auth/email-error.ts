export const EMAIL_IN_USE_MESSAGE = "An account already exists with this email.";

/** Editing or clearing the email clears the "already exists" error. */
export function errorAfterEmailEdit(current: string): string {
  return current === EMAIL_IN_USE_MESSAGE ? "" : current;
}

