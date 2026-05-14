export interface TrustedFormProps {
  onCertificateReady?: (certUrl: string, token: string) => void;
  onCertUrlReady?: (certUrl: string) => void;
  enableSandbox?: boolean;
  provideReferrer?: boolean;
  timeout?: number;
}

export interface TrustedFormCertificate {
  certUrl: string;
  token: string;
}

declare global {
  interface Window {
    field?: string;
    provideReferrer?: boolean;
    sandbox?: boolean;
    TF_READY?: boolean;
  }
}

export const TRUSTEDFORM_SCRIPT_URL = 'https://api.trustedform.com/trustedform.js';
export const TRUSTEDFORM_FIELD_NAME = 'xxTrustedFormCertUrl';
export const TRUSTEDFORM_TOKEN_FIELD_NAME = 'xxTrustedFormToken';
export const TRUSTEDFORM_CERT_ID = 'xxTrustedFormCertUrl_0';
export const TRUSTEDFORM_TOKEN_ID = 'xxTrustedFormToken_0';
