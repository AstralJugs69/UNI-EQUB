import React from 'react';
import { StatusBanner } from './ui';

type ErrorKind = 'auth' | 'payment' | 'formation' | 'kyc' | 'profile' | 'admin' | 'network';

function textFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? '');
}

function normalize(message: string) {
  return message.replace(/\s*\|\s*code\s+[A-Z0-9_]+.*$/i, '').replace(/\s*\(error\s+[^)]+\)/i, '').trim();
}

export function friendlyErrorMessage(kind: ErrorKind, error: unknown) {
  const message = normalize(textFrom(error));
  const lower = message.toLowerCase();

  if (!message) {
    return fallbackFor(kind);
  }
  if (lower.includes('edge function') || lower.includes('pgrst') || lower.includes('violates') || lower.includes('duplicate key') || lower.includes('schema cache')) {
    return 'The request could not be completed because the server state is not ready. Please try again after refreshing.';
  }
  if (lower.includes('invalid session') || lower.includes('expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('kyc verification is required')) {
    return 'Finish KYC verification before using this action.';
  }
  if (lower.includes('banned')) {
    return 'This account is restricted and cannot continue this action.';
  }
  if (lower.includes('can join only one group') || lower.includes('not eligible for normal group formation') || lower.includes('active group')) {
    return 'Your current trust level allows only one active or forming group at a time. Complete or leave the existing request before creating another.';
  }
  if (lower.includes('no open round')) {
    return 'This group is not accepting contributions right now.';
  }
  if (lower.includes('already paid') || lower.includes('already recorded')) {
    return 'Your contribution is already recorded for this round.';
  }
  if (lower.includes('otp')) {
    return 'The OTP could not be confirmed. Check the code and try again.';
  }
  if (lower.includes('invalid email') && lower.includes('phone')) {
    return 'Check your email or phone number and password, then try again.';
  }
  if (lower.includes('password')) {
    return kind === 'auth' ? 'Check your email or phone number and password, then try again.' : 'The password update could not be completed.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Connection failed. Check your internet connection and try again.';
  }
  if (lower.includes('minimum members')) {
    return 'Increase the accepted member minimum before submitting this request.';
  }
  if (lower.includes('maximum members')) {
    return 'Adjust the maximum member count so it matches the group policy.';
  }
  if (lower.includes('grace period')) {
    return 'Choose a grace period between 1 and 72 hours.';
  }

  return message;
}

function fallbackFor(kind: ErrorKind) {
  switch (kind) {
    case 'auth':
      return 'Sign-in could not be completed. Check your details and try again.';
    case 'payment':
      return 'Payment could not be prepared. Please refresh the group and try again.';
    case 'formation':
      return 'The group request could not be updated. Please review the form and try again.';
    case 'kyc':
      return 'KYC could not be submitted. Check your documents and try again.';
    case 'profile':
      return 'Profile settings could not be saved. Please try again.';
    case 'admin':
      return 'The admin action could not be completed. Refresh the queue and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function ErrorBanner({ kind, error, title }: { kind: ErrorKind; error?: unknown; title: string }) {
  const body = error ? friendlyErrorMessage(kind, error) : '';
  return body ? <StatusBanner tone="danger" title={title} body={body} /> : null;
}

export function AuthErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="auth" title="Sign-in needs attention" error={error} />;
}

export function PaymentErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="payment" title="Payment needs attention" error={error} />;
}

export function FormationErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="formation" title="Group request needs attention" error={error} />;
}

export function KycErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="kyc" title="KYC needs attention" error={error} />;
}

export function ProfileErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="profile" title="Profile needs attention" error={error} />;
}

export function AdminErrorBanner({ error }: { error?: unknown }) {
  return <ErrorBanner kind="admin" title="Admin action needs attention" error={error} />;
}
