export function timestamp(d = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const tzo = -d.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tzo) / 60));
  const mm = pad(Math.abs(tzo) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes(),
  )}-${pad(d.getSeconds())}${sign}${hh}${mm}`;
}
