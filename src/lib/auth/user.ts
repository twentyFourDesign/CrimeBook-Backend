export function buildUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`;
}
