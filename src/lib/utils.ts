import { flag, name } from "country-emoji";

export function formatCountry(country: string) {
  return `${flag(country)} ${name(country)}`;
}
