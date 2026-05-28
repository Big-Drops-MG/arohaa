'use client';

import type { TrustedFormCertificate } from '../model/trusted-form';
import { TRUSTEDFORM_CERT_ID, TRUSTEDFORM_TOKEN_ID } from '../model/trusted-form';

export function useTrustedForm(timeout: number = 2000) {
  const getCertificateData = (): Promise<TrustedFormCertificate> => {
    return new Promise((resolve) => {
      const checkForCertificate = () => {
        const certUrlElement = document.getElementById(TRUSTEDFORM_CERT_ID) as HTMLInputElement | null;
        const tokenElement = document.getElementById(TRUSTEDFORM_TOKEN_ID) as HTMLInputElement | null;
        const certUrl = certUrlElement?.value ?? '';
        const token = tokenElement?.value ?? '';

        if (certUrl) {
          resolve({ certUrl, token });
          return;
        }
        setTimeout(checkForCertificate, 100);
      };

      checkForCertificate();

      setTimeout(() => {
        const certUrlElement = document.getElementById(TRUSTEDFORM_CERT_ID) as HTMLInputElement | null;
        const tokenElement = document.getElementById(TRUSTEDFORM_TOKEN_ID) as HTMLInputElement | null;
        resolve({
          certUrl: certUrlElement?.value ?? '',
          token: tokenElement?.value ?? '',
        });
      }, timeout);
    });
  };

  return { getCertificateData };
}
