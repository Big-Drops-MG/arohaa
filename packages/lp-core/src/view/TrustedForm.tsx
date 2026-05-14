'use client';

import { useEffect, useRef } from 'react';
import type { TrustedFormProps } from '../model/trusted-form';
import {
  TRUSTEDFORM_SCRIPT_URL,
  TRUSTEDFORM_FIELD_NAME,
  TRUSTEDFORM_TOKEN_FIELD_NAME,
  TRUSTEDFORM_CERT_ID,
  TRUSTEDFORM_TOKEN_ID,
} from '../model/trusted-form';

const TrustedForm: React.FC<TrustedFormProps> = ({
  onCertificateReady,
  onCertUrlReady,
  enableSandbox = false,
  provideReferrer = false,
  timeout = 2000,
}) => {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const certUrlRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const onCertificateReadyRef = useRef(onCertificateReady);
  const onCertUrlReadyRef = useRef(onCertUrlReady);

  useEffect(() => {
    onCertificateReadyRef.current = onCertificateReady;
    onCertUrlReadyRef.current = onCertUrlReady;
  }, [onCertificateReady, onCertUrlReady]);

  const hasCallback = !!(onCertificateReady ?? onCertUrlReady);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (
      !scriptRef.current &&
      !document.querySelector('script[src*="trustedform.js"]')
    ) {
      const tf = document.createElement('script');
      tf.type = 'text/javascript';
      tf.async = true;
      tf.src = TRUSTEDFORM_SCRIPT_URL;
      window.field = TRUSTEDFORM_FIELD_NAME;
      window.provideReferrer = provideReferrer;
      if (enableSandbox) {
        window.sandbox = true;
      }
      tf.onerror = () => {
        console.warn(
          'TrustedForm script could not be loaded (blocked or network). Form will still submit; cert fields may be empty.'
        );
      };
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(tf, firstScript);
        scriptRef.current = tf;
      }
    }
  }, [enableSandbox, provideReferrer]);

  useEffect(() => {
    if (typeof document === 'undefined' || !hasCallback) return;

    const interval = setInterval(() => {
      const certUrl = certUrlRef.current?.value;
      const token = tokenRef.current?.value;

      if (certUrl) {
        const onCert = onCertificateReadyRef.current;
        const onUrl = onCertUrlReadyRef.current;
        if (onCert && token) {
          onCert(certUrl, token);
        } else if (onUrl) {
          onUrl(certUrl);
        }
        clearInterval(interval);
      }
    }, 500);

    const t = setTimeout(() => clearInterval(interval), timeout + 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(t);
    };
  }, [timeout, hasCallback]);

  return (
    <>
      <input
        type="hidden"
        id={TRUSTEDFORM_CERT_ID}
        name={TRUSTEDFORM_FIELD_NAME}
        ref={certUrlRef}
      />
      <input
        type="hidden"
        id={TRUSTEDFORM_TOKEN_ID}
        name={TRUSTEDFORM_TOKEN_FIELD_NAME}
        ref={tokenRef}
      />
    </>
  );
};

export default TrustedForm;
