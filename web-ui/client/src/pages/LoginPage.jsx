import { useEffect, useState } from 'react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Satoshi:wght@400;500;600&display=swap');

  .login-body {
    font-family: 'Satoshi', system-ui, sans-serif;
    background-color: oklch(98.5% .004 80);
    color: oklch(18% .014 80);
    font-optical-sizing: auto;
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: 24px;
    background-image:
      radial-gradient(ellipse 80% 60% at 50% -10%, oklch(96% .035 85 / .7), transparent),
      radial-gradient(ellipse 50% 40% at 85% 90%,  oklch(93% .028 80 / .4), transparent);
    margin: 0;
  }

  .login-card {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 12px 48px oklch(18% .012 80 / 0.14);
    padding: 52px 48px;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    border: 1px solid oklch(91% .010 80 / .8);
  }

  .login-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .login-logo-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(145deg, oklch(82% .150 85), oklch(66% .160 65));
    display: grid;
    place-items: center;
    box-shadow: 0 4px 16px oklch(76% .170 85 / .35);
  }

  .login-logo-icon svg {
    width: 28px;
    height: 28px;
    fill: #fff;
  }

  .login-logo-wordmark {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: oklch(22% .012 80);
  }

  .login-hero {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .login-hero h1 {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: clamp(22px, 5vw, 28px);
    font-weight: 750;
    letter-spacing: -0.6px;
    color: oklch(22% .012 80);
    line-height: 1.2;
    margin: 0;
  }

  .login-hero p {
    font-size: 15px;
    color: oklch(62% .018 80);
    line-height: 1.5;
    margin: 0;
  }

  .login-divider {
    width: 100%;
    height: 1px;
    background: oklch(91% .010 80);
  }

  .login-btn-ms {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 14px 24px;
    border-radius: 14px;
    background: oklch(22% .012 80);
    color: #fff;
    font-family: 'Satoshi', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.15px;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    box-shadow: 0 2px 8px oklch(18% .012 80 / .18);
    min-height: 52px;
  }

  .login-btn-ms:hover {
    background: oklch(28% .016 80);
    box-shadow: 0 4px 16px oklch(18% .012 80 / .25);
    transform: translateY(-1px);
  }

  .login-btn-ms:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .login-btn-ms:focus-visible {
    outline: 2px solid oklch(76% .170 85);
    outline-offset: 3px;
  }

  .login-btn-ms svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .login-error-banner {
    width: 100%;
    padding: 12px 16px;
    border-radius: 10px;
    background: oklch(96% .030 25);
    border: 1px solid oklch(88% .060 25);
    color: oklch(42% .100 25);
    font-size: 14px;
    line-height: 1.4;
  }

  .login-footer {
    text-align: center;
    font-size: 12px;
    color: oklch(72% .016 80);
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .login-btn-ms { transition: none; }
  }

  @media (max-width: 480px) {
    .login-card { padding: 36px 28px; }
  }
`;

const ERROR_MESSAGES = {
  invalid_state: 'Authentication failed — please try again.',
  no_email: 'Could not retrieve your email from Microsoft. Please try again.',
  access_denied: 'Access was denied. Please allow the required permissions.',
};

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setErrorMessage(ERROR_MESSAGES[err] || `Sign-in error: ${err.replace(/_/g, ' ')}`);
    }
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="login-body">
        <main className="login-card" role="main">
          <div className="login-logo" aria-label="Mail Assistant logo">
            <div className="login-logo-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" />
              </svg>
            </div>
            <span className="login-logo-wordmark">Mail Assistant</span>
          </div>

          <div className="login-hero">
            <h1>Welcome back</h1>
            <p>Sign in with your Microsoft account to access your customer workspace.</p>
          </div>

          <div className="login-divider" role="separator" />

          {errorMessage && (
            <div className="login-error-banner" role="alert" aria-live="polite">
              {errorMessage}
            </div>
          )}

          <a
            href="/crm/auth/login"
            className="login-btn-ms"
            role="button"
            aria-label="Sign in with Microsoft"
          >
            <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="0"  y="0"  width="10" height="10" fill="#f25022" />
              <rect x="11" y="0"  width="10" height="10" fill="#7fba00" />
              <rect x="0"  y="11" width="10" height="10" fill="#00a4ef" />
              <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </a>

          <p className="login-footer">
            Your email account data stays private.<br />
            Each login is scoped to your account.
          </p>
        </main>
      </div>
    </>
  );
}
