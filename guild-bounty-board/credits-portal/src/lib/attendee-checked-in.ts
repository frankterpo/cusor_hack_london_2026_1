/**
 * Whether an attendee record has a real Luma / ops check-in timestamp (string or Firestore Timestamp).
 */
export function hasMeaningfulCheckedIn(data: Record<string, unknown>): boolean {
  const c = data.checkedInAt;
  if (c == null || c === "") return false;
  if (
    typeof c === "object" &&
    c !== null &&
    "toDate" in c &&
    typeof (c as { toDate: () => Date }).toDate === "function"
  ) {
    const d = (c as { toDate: () => Date }).toDate();
    if (!d || Number.isNaN(d.getTime())) return false;
    return d.getFullYear() >= 1900;
  }
  if (typeof c === "string") {
    if (c.startsWith("0001")) return false;
    return c.trim().length > 4;
  }
  return Boolean(c);
}
