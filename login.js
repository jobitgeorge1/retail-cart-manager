import { account, ID, isConfigured } from "./appwrite-client.js";

const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const status = document.getElementById("status");

function setStatus(text) {
  status.textContent = text;
}

function getCreds() {
  return {
    name: String(nameInput.value || "").trim(),
    email: String(emailInput.value || "").trim(),
    password: String(passwordInput.value || "")
  };
}

async function login() {
  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    return;
  }
  const { email, password } = getCreds();
  if (!email || !password) {
    setStatus("Enter email and password.");
    return;
  }

  try {
    try {
      await account.deleteSession("current");
    } catch {
      // Ignore if no active session.
    }
    await account.createEmailPasswordSession(email, password);
    window.location.href = "./app.html";
  } catch (error) {
    setStatus(`Login failed. ${error?.message || ""}`.trim());
  }
}

async function signup() {
  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    return;
  }
  const { name, email, password } = getCreds();
  if (!email || !password) {
    setStatus("Enter email and password.");
    return;
  }

  try {
    await account.create(ID.unique(), email, password, name || undefined);
    await account.createEmailPasswordSession(email, password);
    window.location.href = "./app.html";
  } catch (error) {
    setStatus(`Sign up failed. ${error?.message || ""}`.trim());
  }
}

async function init() {
  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    loginBtn.disabled = true;
    signupBtn.disabled = true;
    return;
  }

  try {
    await account.get();
    window.location.href = "./app.html";
  } catch {
    setStatus("Use your account to sync cart data across devices.");
  }
}

loginBtn.addEventListener("click", login);
signupBtn.addEventListener("click", signup);

init();
