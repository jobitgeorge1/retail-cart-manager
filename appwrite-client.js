import { Account, Client, Databases, ID, Permission, Query, Role } from "https://cdn.jsdelivr.net/npm/appwrite@15.0.0/+esm";

export const APPWRITE_CONFIG = {
  endpoint: "https://syd.cloud.appwrite.io/v1",
  projectId: "69a42ae4000b179052cc",
  databaseId: "69a42d9300336b242511",
  collectionId: "retail_cart_states"
};

export const client = new Client();
client.setEndpoint(APPWRITE_CONFIG.endpoint).setProject(APPWRITE_CONFIG.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export { ID, Permission, Query, Role };

export function isConfigured() {
  return !!APPWRITE_CONFIG.endpoint &&
    !!APPWRITE_CONFIG.projectId &&
    !!APPWRITE_CONFIG.databaseId &&
    !!APPWRITE_CONFIG.collectionId;
}

export function makeUserDocumentId(userId) {
  return String(`user-${userId}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 36);
}

export function userPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.write(Role.user(userId))
  ];
}
