export type ContactsResult = "granted" | "denied" | "undetermined";

export async function requestContactsPermission(): Promise<ContactsResult> {
  return "undetermined";
}
