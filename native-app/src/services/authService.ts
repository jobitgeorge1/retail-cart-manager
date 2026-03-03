import { account, APPWRITE_CONFIG, databases, ID, Permission, Role, usernameDocId } from '../config/appwrite';
import type { SessionUser } from '../types';

function mapUser(raw: any): SessionUser {
  return {
    id: String(raw?.$id || ''),
    name: String(raw?.name || ''),
    email: String(raw?.email || ''),
  };
}

async function resolveEmailFromIdentifier(identifier: string): Promise<string> {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;

  const id = usernameDocId(value);
  if (id.length < 8) return '';

  try {
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, id);
    const payload = JSON.parse(String(doc?.payload || '{}'));
    return String(payload?.email || '').toLowerCase();
  } catch (error: any) {
    if (error?.code === 404 || error?.type === 'document_not_found') return '';
    throw error;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const user = await account.get();
    return mapUser(user);
  } catch {
    return null;
  }
}

export async function signIn(identifier: string, password: string): Promise<SessionUser> {
  const email = await resolveEmailFromIdentifier(identifier);
  if (!email) {
    throw new Error('User not found');
  }

  try {
    await account.deleteSession('current');
  } catch {
    // No active session.
  }

  await account.createEmailPasswordSession(email, password);
  const user = await account.get();
  return mapUser(user);
}

export async function signUp(name: string, email: string, username: string, password: string): Promise<SessionUser> {
  const unameDoc = usernameDocId(username);

  try {
    await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, unameDoc);
    throw new Error('Username already exists');
  } catch (error: any) {
    if (!(error?.code === 404 || error?.type === 'document_not_found')) {
      throw error;
    }
  }

  const created = await account.create(ID.unique(), email.trim().toLowerCase(), password, name.trim());
  await account.createEmailPasswordSession(email.trim().toLowerCase(), password);

  await databases.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collectionId,
    unameDoc,
    {
      payload: JSON.stringify({
        type: 'username_index',
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
      }),
    },
    [Permission.read(Role.any()), Permission.write(Role.user(created.$id))],
  );

  return {
    id: created.$id,
    name: created.name,
    email: created.email,
  };
}

export async function signOut(): Promise<void> {
  await account.deleteSession('current');
}
