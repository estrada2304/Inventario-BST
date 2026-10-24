'use client';

import { GoogleAuthProvider, signInWithPopup, Auth } from 'firebase/auth';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
];

// In-memory token storage
let inMemoryAccessToken: string | null = null;

export function getGmailAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setGmailAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

/**
 * Initiates Google sign-in with Gmail scopes.
 * Caches the access token in memory upon success.
 */
export async function connectGmailAccount(auth: Auth): Promise<{ accessToken: string; user: any }> {
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Gmail.');
    }

    inMemoryAccessToken = credential.accessToken;
    return {
      accessToken: credential.accessToken,
      user: result.user,
    };
  } catch (error) {
    console.error('Error al conectar con Gmail:', error);
    throw error;
  }
}

/**
 * Encodes an email into base64url RFC 2822 format for the Gmail API.
 */
function buildRawEmail({
  to,
  subject,
  body,
  cc,
  bcc,
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): string {
  const emailLines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    '',
    body,
  ].filter(Boolean) as string[];

  const rawString = emailLines.join('\r\n');

  return btoa(unescape(encodeURIComponent(rawString)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email using the Gmail API `users/me/messages/send`.
 */
export async function sendGmailMessage({
  to,
  subject,
  body,
  cc,
  bcc,
  accessToken,
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  accessToken?: string;
}) {
  const token = accessToken || inMemoryAccessToken;
  if (!token) {
    throw new Error('Se requiere conectar la cuenta de Gmail para enviar correos.');
  }

  const raw = buildRawEmail({ to, subject, body, cc, bcc });

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Error al enviar correo vía Gmail (${response.status})`
    );
  }

  return await response.json();
}

/**
 * Fetches Gmail User Profile (email address, messages count, etc.)
 */
export async function getGmailProfile(accessToken?: string) {
  const token = accessToken || inMemoryAccessToken;
  if (!token) return null;

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      inMemoryAccessToken = null;
    }
    return null;
  }

  return await response.json();
}
