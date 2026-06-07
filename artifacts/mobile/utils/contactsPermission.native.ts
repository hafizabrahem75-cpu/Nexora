import * as Contacts from "expo-contacts";

export type ContactsResult = "granted" | "denied" | "undetermined";

export async function requestContactsPermission(): Promise<ContactsResult> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status as ContactsResult;
}
