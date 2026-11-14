const ENVELOPE_FORMAT = "clinic-system-encrypted-backup";
const BACKUP_FORMAT = "clinic-system-backup";
const VERSION = 1;
const ITERATIONS = 600_000;
const textEncoder = new TextEncoder();

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid encrypted backup file.");
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(passphrase, salt, usage) {
  const material = await crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

function ensureCryptoSupport() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure encryption is unavailable in this browser. Open the clinic app using HTTPS or localhost.");
  }
}

export async function encryptBackup(backup, passphrase) {
  ensureCryptoSupport();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, "encrypt");
  const plaintext = textEncoder.encode(JSON.stringify(backup));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, plaintext);

  return {
    format: ENVELOPE_FORMAT,
    version: VERSION,
    encryption: {
      cipher: "AES-256-GCM",
      kdf: "PBKDF2-HMAC-SHA-256",
      iterations: ITERATIONS,
      tag_length: 128,
      salt: toBase64(salt),
      iv: toBase64(iv),
    },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptBackup(envelope, passphrase) {
  ensureCryptoSupport();
  const metadata = envelope?.encryption;
  if (envelope?.format !== ENVELOPE_FORMAT || envelope?.version !== VERSION
    || metadata?.cipher !== "AES-256-GCM"
    || metadata?.kdf !== "PBKDF2-HMAC-SHA-256"
    || metadata?.iterations !== ITERATIONS
    || metadata?.tag_length !== 128) {
    throw new Error("Unsupported or invalid encrypted backup file.");
  }

  try {
    const salt = fromBase64(metadata.salt);
    const iv = fromBase64(metadata.iv);
    const ciphertext = fromBase64(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error("Invalid encrypted backup file.");
    const key = await deriveKey(passphrase, salt, "decrypt");
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext);
    const backup = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
    if (backup?.format !== BACKUP_FORMAT || backup?.version !== VERSION || !backup.tables || typeof backup.tables !== "object") {
      throw new Error("Backup contents are invalid.");
    }
    return backup;
  } catch {
    throw new Error("Could not decrypt this backup. Check the passphrase or file integrity.");
  }
}
