const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { randomUUID } = require("crypto");
admin.initializeApp();
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");
const GITHUB_REPOSITORY = defineSecret("GITHUB_REPOSITORY");
const allowedRoles = ["codeur", "programmeur", "admin", "administrateur"];
const emailKey = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
exports.requestOpenStoreBuild = onCall({ region: "europe-west1", secrets: [GITHUB_TOKEN, GITHUB_REPOSITORY], timeoutSeconds: 60 }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connecte-toi à OpenStore.");
  const data = request.data || {};
  const snap = await admin.database().ref("store_users/" + emailKey(request.auth.token.email)).get();
  const role = String((snap.val() || {}).role || "").trim().toLowerCase();
  if (!allowedRoles.includes(role)) throw new HttpsError("permission-denied", "Réservé aux rôles Codeur, Programmeur et Administrateur.");
  const mode = String(data.mode || "");
  if (!["web", "aab", "project"].includes(mode)) throw new HttpsError("invalid-argument", "Mode de compilation invalide.");
  const safeAppName = String(data.appName || "OpenStore App").replace(/[^A-Za-z0-9 _.-]/g, "").slice(0,45) || "OpenStore App";
  const payload = { mode, appName: safeAppName, requestId: String(data.requestId || randomUUID()), requestedBy: request.auth.token.email || "unknown" };
  if (mode === "web") {
    const url = String(data.url || "");
    let parsed; try { parsed = new URL(url); } catch { throw new HttpsError("invalid-argument", "URL invalide."); }
    if (parsed.protocol !== "https:" || /[\"'`\\\n\r<>]/.test(url)) throw new HttpsError("invalid-argument", "Le site doit utiliser une URL HTTPS valide.");
    const packageId = String(data.packageId || "");
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageId)) throw new HttpsError("invalid-argument", "Identifiant Android invalide.");
    payload.url = url; payload.packageId = packageId;
  } else {
    const storagePath = String(data.storagePath || "");
    if (!storagePath.startsWith("build-uploads/" + request.auth.uid + "/")) throw new HttpsError("permission-denied", "Chemin de fichier non autorisé.");
    const file = admin.storage().bucket().file(storagePath);
    const [exists] = await file.exists(); if (!exists) throw new HttpsError("not-found", "Fichier importé introuvable.");
    const [meta] = await file.getMetadata();
    if (Number(meta.size || 0) > 200 * 1024 * 1024) throw new HttpsError("invalid-argument", "Fichier trop volumineux.");
    const [downloadUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    payload.downloadUrl = downloadUrl; payload.originalFileName = String(data.originalFileName || "upload").slice(0,180);
  }
  const repo = GITHUB_REPOSITORY.value();
  if (!/^[^/]+\/[^/]+$/.test(repo)) throw new HttpsError("failed-precondition", "Le secret GITHUB_REPOSITORY doit être au format propriétaire/dépôt.");
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${GITHUB_TOKEN.value()}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "openstore_build", client_payload: payload })
  });
  if (!response.ok) { const details = await response.text(); console.error("GitHub dispatch failed", response.status, details); throw new HttpsError("internal", "GitHub n'a pas accepté la demande de compilation. Vérifie le jeton et le dépôt."); }
  return { ok: true, message: "Demande envoyée à GitHub Actions." };
});
