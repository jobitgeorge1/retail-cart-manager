import { account, databases, APPWRITE_CONFIG, ID, Permission, Role, isConfigured } from "./appwrite-client.js";

const modeSignInBtn = document.getElementById("modeSignInBtn");
const modeSignUpBtn = document.getElementById("modeSignUpBtn");
const identifierInput = document.getElementById("identifierInput");
const passwordInput = document.getElementById("passwordInput");
const nameInput = document.getElementById("nameInput");
const signupEmailInput = document.getElementById("signupEmailInput");
const signupUsernameInput = document.getElementById("signupUsernameInput");
const submitBtn = document.getElementById("submitBtn");
const status = document.getElementById("status");

let mode = "signin";

function setStatus(text) {
  status.textContent = text;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function usernameDocId(username) {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3) return "";
  return `uname-${normalized}`.slice(0, 36);
}

function setMode(nextMode) {
  mode = nextMode;
  const isSignUp = mode === "signup";

  modeSignInBtn.classList.toggle("active", !isSignUp);
  modeSignInBtn.classList.toggle("secondary", isSignUp);
  modeSignUpBtn.classList.toggle("active", isSignUp);
  modeSignUpBtn.classList.toggle("secondary", !isSignUp);

  nameInput.classList.toggle("hidden", !isSignUp);
  signupEmailInput.classList.toggle("hidden", !isSignUp);
  signupUsernameInput.classList.toggle("hidden", !isSignUp);

  identifierInput.classList.toggle("hidden", isSignUp);
  submitBtn.textContent = isSignUp ? "Create Account" : "Sign In";
  setStatus(isSignUp ? "Create your account to start syncing." : "Sign in to access your synced data.");
}

async function resolveEmailFromIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return "";
  if (value.includes("@")) return value.toLowerCase();

  const docId = usernameDocId(value);
  if (!docId) return "";

  try {
    const doc = await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collectionId,
      docId
    );
    const parsed = JSON.parse(String(doc.payload || "{}"));
    return String(parsed.email || "").trim().toLowerCase();
  } catch (error) {
    if (error?.type === "document_not_found" || error?.code === 404) return "";
    throw error;
  }
}

async function signin() {
  const identifier = String(identifierInput.value || "").trim();
  const password = String(passwordInput.value || "");
  if (!identifier || !password) {
    setStatus("Enter email/username and password.");
    return;
  }

  try {
    const email = await resolveEmailFromIdentifier(identifier);
    if (!email) {
      setStatus("User not found.");
      return;
    }

    try {
      await account.deleteSession("current");
    } catch {
      // Ignore if no active session.
    }

    await account.createEmailPasswordSession(email, password);
    window.location.href = "./app.html";
  } catch (error) {
    setStatus(`Sign in failed. ${error?.message || ""}`.trim());
  }
}

async function signup() {
  const name = String(nameInput.value || "").trim();
  const email = String(signupEmailInput.value || "").trim().toLowerCase();
  const username = String(signupUsernameInput.value || "").trim();
  const password = String(passwordInput.value || "");

  if (!name || !email || !username || !password) {
    setStatus("Enter name, email, username, and password.");
    return;
  }

  const usernameId = usernameDocId(username);
  if (!usernameId) {
    setStatus("Username must be at least 3 characters and use letters/numbers/._-");
    return;
  }

  try {
    // Username uniqueness is enforced by unique document ID in DB.
    try {
      await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, usernameId);
      setStatus("Username already exists. Choose another username.");
      return;
    } catch (error) {
      if (!(error?.type === "document_not_found" || error?.code === 404)) {
        throw error;
      }
    }

    const createdUser = await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collectionId,
      usernameId,
      {
        payload: JSON.stringify({
          type: "username_index",
          username: normalizeUsername(username),
          email
        })
      },
      [
        Permission.read(Role.any()),
        Permission.write(Role.user(createdUser.$id))
      ]
    );

    window.location.href = "./app.html";
  } catch (error) {
    setStatus(`Sign up failed. ${error?.message || ""}`.trim());
  }
}

async function submit() {
  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    return;
  }
  if (mode === "signup") {
    await signup();
  } else {
    await signin();
  }
}

async function init() {
  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    submitBtn.disabled = true;
    modeSignInBtn.disabled = true;
    modeSignUpBtn.disabled = true;
    return;
  }

  try {
    await account.get();
    window.location.href = "./app.html";
  } catch {
    setMode("signin");
  }
}

modeSignInBtn.addEventListener("click", () => setMode("signin"));
modeSignUpBtn.addEventListener("click", () => setMode("signup"));
submitBtn.addEventListener("click", submit);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
});
identifierInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && mode === "signin") submit();
});
signupUsernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && mode === "signup") submit();
});

init();
