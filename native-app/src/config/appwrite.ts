import { Account, Client, Databases, ID, Permission, Query, Role } from 'react-native-appwrite';

export const APPWRITE_CONFIG = {
  endpoint: 'https://syd.cloud.appwrite.io/v1',
  projectId: '69a42ae4000b179052cc',
  databaseId: '69a42d9300336b242511',
  collectionId: 'retail_cart_states',
  platform: 'com.jobit.personalcartmanager.native',
};

export const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId)
  .setPlatform(APPWRITE_CONFIG.platform);

export const account = new Account(client);
export const databases = new Databases(client);

export { ID, Permission, Query, Role };

export function makeUserDocumentId(userId: string): string {
  return `user-${String(userId).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`.slice(0, 36);
}

export function userPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.write(Role.user(userId)),
  ];
}

export function usernameDocId(username: string): string {
  const normalized = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
  return (`uname-${normalized}`).slice(0, 36);
}
