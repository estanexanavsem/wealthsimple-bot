import { flag, name } from "country-emoji";

export function formatCountry(country?: string) {
  if (!country) {
    return "Unknown";
  }

  return `${flag(country)} ${name(country)}`;
}
