export const localISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y,m,d] = value.split("-").map(Number), date = new Date(y,m-1,d);
  return y >= 1900 && y <= 9999 && localISO(date) === value ? date : null;
}
