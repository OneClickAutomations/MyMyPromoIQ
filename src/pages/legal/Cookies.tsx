import LegalLayout from '../../components/LegalLayout'

export default function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="June 26, 2025">
      <div className="callout">
        PromoIQ uses a minimal set of cookies — only what is strictly necessary to operate the platform, authenticate users, and measure performance. We do not sell cookie data or use third-party ad tracking cookies.
      </div>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files placed on your device by a website you visit. They are widely used to make websites work efficiently and to provide information to the site owner. Cookies may be "session cookies" (deleted when you close your browser) or "persistent cookies" (retained for a set period).
      </p>

      <h2>2. Cookies We Use</h2>

      <h3>2.1 Strictly Necessary Cookies</h3>
      <p>
        These cookies are essential for the Service to function. You cannot opt out of them because they enable core functionality such as authentication and security.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>__clerk_db_jwt</code></td>
            <td>Clerk</td>
            <td>Stores your authentication session token</td>
            <td>Session</td>
          </tr>
          <tr>
            <td><code>__session</code></td>
            <td>Clerk</td>
            <td>Maintains your logged-in state across page loads</td>
            <td>Session</td>
          </tr>
          <tr>
            <td><code>__client_uat</code></td>
            <td>Clerk</td>
            <td>Detects active user sessions for security checks</td>
            <td>1 year</td>
          </tr>
        </tbody>
      </table>

      <h3>2.2 Functional Cookies</h3>
      <p>
        These cookies remember your preferences to improve your experience. They are not essential but enhance usability.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>promoiq_theme</code></td>
            <td>PromoIQ</td>
            <td>Stores your UI preferences (currently always dark mode)</td>
            <td>1 year</td>
          </tr>
          <tr>
            <td><code>promoiq_dismissed</code></td>
            <td>PromoIQ</td>
            <td>Remembers which banners or modals you have dismissed</td>
            <td>30 days</td>
          </tr>
        </tbody>
      </table>

      <h3>2.3 Analytics Cookies</h3>
      <p>
        We use privacy-first analytics to understand aggregate usage patterns. No personal identifiers are collected or shared with advertisers.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>_ga</code>, <code>_ga_*</code></td>
            <td>Google Analytics (if enabled)</td>
            <td>Distinguishes unique users; measures session and page-view counts</td>
            <td>2 years / 1 day</td>
          </tr>
        </tbody>
      </table>

      <h3>2.4 Cookies We Do NOT Use</h3>
      <ul>
        <li>Third-party advertising or retargeting cookies (Meta Pixel, Google Ads tag, etc.)</li>
        <li>Cross-site tracking cookies</li>
        <li>Fingerprinting or device identification scripts</li>
      </ul>

      <h2>3. Local Storage</h2>
      <p>
        In addition to cookies, PromoIQ uses browser local storage to cache non-sensitive UI state (e.g. your last selected campaign style). This data stays on your device and is not transmitted to our servers.
      </p>

      <h2>4. Your Choices</h2>

      <h3>4.1 Browser Controls</h3>
      <p>
        You can set your browser to refuse all cookies or to alert you when cookies are being sent. Note that blocking strictly necessary cookies will prevent the Service from functioning. Links to cookie settings for common browsers:
      </p>
      <ul>
        <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
        <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
        <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" target="_blank" rel="noopener noreferrer">Apple Safari</a></li>
        <li><a href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
      </ul>

      <h3>4.2 Opt-Out of Analytics</h3>
      <p>
        You can opt out of Google Analytics tracking by installing the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-Out Browser Add-on</a>.
      </p>

      <h2>5. Legal Basis for Cookies (GDPR)</h2>
      <ul>
        <li><strong>Strictly necessary cookies</strong> — processed on the basis of legitimate interest (Art. 6(1)(f)) to operate a secure, functioning service; consent is not required</li>
        <li><strong>Functional cookies</strong> — processed on the basis of your consent or legitimate interest in providing a personalised experience</li>
        <li><strong>Analytics cookies</strong> — processed on the basis of your consent where required by applicable law</li>
      </ul>

      <h2>6. Do Not Track</h2>
      <p>
        Some browsers offer a "Do Not Track" (DNT) signal. We honour DNT signals where technically feasible by disabling non-essential analytics collection. Strictly necessary cookies are unaffected.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy as we change the cookies we use or as applicable law changes. We will post changes here with an updated "Last updated" date. For material changes we will notify you by email or in-app banner.
      </p>

      <h2>8. Contact</h2>
      <p>
        For questions about how we use cookies:<br />
        <a href="mailto:privacy@promoiq.com">privacy@promoiq.com</a>
      </p>
    </LegalLayout>
  )
}
