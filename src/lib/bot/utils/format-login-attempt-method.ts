import type { LoginAttemptMethod } from "@/types";

export function formatLoginAttemptMethod(method: LoginAttemptMethod): string {
  return {
    email: "✉️ EMAIL",
    phone: "📱 PHONE",
  }[method];
}
