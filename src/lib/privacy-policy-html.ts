/** Update this when a dedicated support inbox is ready. */
const PRIVACY_CONTACT_EMAIL = 'privacy@carstatix.com';

const LAST_UPDATED = 'September 20, 2026';

export function renderPrivacyPolicyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>Privacy Policy · CarStatix</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a222c;
      --text: #f2f5f8;
      --muted: #9aa7b5;
      --line: rgba(255,255,255,0.08);
      --accent: #3d9cf0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(1200px 600px at 20% -10%, #1c3a57 0%, var(--bg) 55%);
      color: var(--text);
      line-height: 1.55;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    .brand {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
    }
    .brand strong { font-size: 1.15rem; letter-spacing: 0.02em; }
    .brand span { color: var(--muted); font-size: 0.9rem; }
    h1 {
      font-size: 1.85rem;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }
    .meta { color: var(--muted); margin: 0 0 28px; font-size: 0.95rem; }
    .card {
      background: color-mix(in srgb, var(--card) 92%, black);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 22px 20px;
      margin-bottom: 14px;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 10px;
    }
    p, li { color: #d7dee6; }
    p { margin: 0 0 10px; }
    p:last-child, ul:last-child { margin-bottom: 0; }
    ul { margin: 0 0 10px; padding-left: 1.2rem; }
    li { margin-bottom: 6px; }
    a { color: var(--accent); }
    footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <strong>CarStatix</strong>
      <span>Privacy Policy</span>
    </div>

    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: ${LAST_UPDATED}</p>

    <section class="card">
      <h2>1. Who we are</h2>
      <p>
        CarStatix (“we”, “us”, “our”) is a mobile application that helps users
        verify vehicles using VIN lookup, OBD-II diagnostics, inspection photos,
        and listing information. This policy explains what data we collect and
        how we use it.
      </p>
    </section>

    <section class="card">
      <h2>2. Information we collect</h2>
      <p>Depending on how you use the app, we may collect:</p>
      <ul>
        <li><strong>Account information:</strong> name, email address, password (stored securely as a hash), and an account/user ID.</li>
        <li><strong>Contact details for listings:</strong> phone number and optional location text you enter.</li>
        <li><strong>Precise location:</strong> GPS coordinates used to time- and location-stamp verification photos and videos while you capture them.</li>
        <li><strong>Photos and videos:</strong> images/videos you capture in the app for vehicle inspection and documentation.</li>
        <li><strong>Vehicle and diagnostic data:</strong> VIN, OBD-II trouble codes, sensor/readiness data, and inspection notes.</li>
        <li><strong>Other user content:</strong> listing details, notes, and links you choose to provide.</li>
      </ul>
      <p>
        We do not sell your personal information and we do not use advertising
        or analytics SDKs in the CarStatix app for cross-app tracking.
      </p>
    </section>

    <section class="card">
      <h2>3. How we use information</h2>
      <ul>
        <li>Create and manage your account.</li>
        <li>Generate and store vehicle verification reports.</li>
        <li>Connect to your OBD-II adapter over Bluetooth and save scan results you choose to record.</li>
        <li>Stamp and store inspection media with capture time and location.</li>
        <li>Publish reports you choose to make public (for example via QR / share link).</li>
        <li>Provide optional plain-language explanations of diagnostic trouble codes (which may be processed by our servers and, when enabled, an AI provider).</li>
        <li>Operate, secure, and improve the service.</li>
      </ul>
    </section>

    <section class="card">
      <h2>4. How we share information</h2>
      <p>We may share data with:</p>
      <ul>
        <li><strong>Service providers</strong> that host our API, database, and media storage (for example cloud hosting and object storage).</li>
        <li><strong>AI providers</strong> (when enabled) to generate educational explanations of OBD fault codes you request.</li>
        <li><strong>Other users / the public</strong> only for information included in a report you publish.</li>
        <li><strong>Legal authorities</strong> when required by law or to protect rights and safety.</li>
      </ul>
      <p>We do not share your data with advertising networks for tracking.</p>
    </section>

    <section class="card">
      <h2>5. Device permissions</h2>
      <p>CarStatix may request access to:</p>
      <ul>
        <li>Bluetooth — to connect to an OBD-II adapter.</li>
        <li>Camera — to scan VINs and capture inspection media.</li>
        <li>Location (while using the app) — to stamp media with GPS coordinates.</li>
        <li>Photo library (add only) — if you export a QR code to your library.</li>
      </ul>
      <p>You can deny or revoke these permissions in your device settings. Some features will not work without them.</p>
    </section>

    <section class="card">
      <h2>6. Data retention</h2>
      <p>
        We keep account, report, diagnostic, and media data for as long as needed
        to provide the service and published reports, unless you request deletion
        earlier or we are required by law to keep it longer.
      </p>
    </section>

    <section class="card">
      <h2>7. Your choices and rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, or
        delete personal data, or to ask questions about how we process it.
        Contact us using the email below and we will respond within a reasonable time.
      </p>
    </section>

    <section class="card">
      <h2>8. Children’s privacy</h2>
      <p>
        CarStatix is not directed to children under 13 (or the minimum age
        required in your country). We do not knowingly collect personal
        information from children.
      </p>
    </section>

    <section class="card">
      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The “Last updated”
        date at the top will change when we do. Continued use of the app after
        an update means you accept the revised policy.
      </p>
    </section>

    <section class="card">
      <h2>10. Contact</h2>
      <p>
        Privacy requests and questions:
        <a href="mailto:${PRIVACY_CONTACT_EMAIL}">${PRIVACY_CONTACT_EMAIL}</a>
      </p>
      <p>
        If you need a different contact address for App Store or business use,
        update this policy page and redeploy.
      </p>
    </section>

    <footer>
      © ${new Date().getFullYear()} CarStatix. All rights reserved.
    </footer>
  </div>
</body>
</html>`;
}
