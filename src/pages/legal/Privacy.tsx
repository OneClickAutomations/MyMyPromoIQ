import LegalLayout from '../../components/LegalLayout'

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="June 26, 2025">
      <div className="callout">
        Your privacy matters. This policy explains what data PromoIQ collects, why, how it is protected, and what rights you have over it — in plain English.
      </div>

      <h2>1. Who We Are</h2>
      <p>
        PromoIQ ("PromoIQ", "we", "us", or "our") operates the AI UGC video generation platform accessible at promoiq.com and its subdomains. We are the data controller for personal data collected through our services.
      </p>
      <p>Contact: <a href="mailto:privacy@promoiq.com">privacy@promoiq.com</a></p>

      <h2>2. Data We Collect</h2>

      <h3>2.1 Account Data</h3>
      <ul>
        <li>Name and email address (provided during sign-up via Supabase Auth)</li>
        <li>Authentication identifiers and session tokens</li>
        <li>Profile information you optionally provide</li>
      </ul>

      <h3>2.2 Usage Data</h3>
      <ul>
        <li>Campaign names, product descriptions, and style selections you enter</li>
        <li>Product image URLs you submit for video generation</li>
        <li>AI-generated director prompts and rendered video URLs</li>
        <li>Feature usage patterns, page views, and navigation events</li>
        <li>API request timestamps, response codes, and latency metrics</li>
      </ul>

      <h3>2.3 Technical Data</h3>
      <ul>
        <li>IP address, browser type, device type, and operating system</li>
        <li>Referrer URLs and UTM parameters</li>
        <li>Session cookies and authentication tokens (see Cookie Policy)</li>
      </ul>

      <h3>2.4 Payment Data</h3>
      <p>
        Billing is processed by Stripe. We do not store card numbers, CVVs, or full payment credentials. We retain only a Stripe customer ID, plan name, and billing status.
      </p>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li><strong>Service delivery</strong> — to authenticate you, run AI generation pipelines, and return finished video assets</li>
        <li><strong>Product improvement</strong> — to analyse aggregate usage patterns and fix bugs</li>
        <li><strong>Communication</strong> — to send transactional emails (receipts, password resets) and, with your consent, product updates</li>
        <li><strong>Legal compliance</strong> — to meet obligations under applicable law and respond to lawful requests</li>
        <li><strong>Fraud prevention</strong> — to detect and block abuse of the platform</li>
      </ul>

      <h2>4. Third-Party Sub-Processors</h2>
      <p>
        We share data with the following sub-processors to operate the service. Each is bound by a data processing agreement and maintains appropriate security standards.
      </p>
      <table>
        <thead>
          <tr>
            <th>Processor</th>
            <th>Purpose</th>
            <th>Data shared</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Supabase</strong></td>
            <td>Authentication, database &amp; media storage</td>
            <td>Name, email, session tokens, campaign data, product images, generated videos</td>
            <td>USA / EU (ISO 27001)</td>
          </tr>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td>AI prompt generation</td>
            <td>Product descriptions, style inputs</td>
            <td>USA</td>
          </tr>
          <tr>
            <td><strong>Higgsfield</strong></td>
            <td>Video rendering &amp; image generation</td>
            <td>Product images, director prompts</td>
            <td>USA</td>
          </tr>
          <tr>
            <td><strong>Stripe</strong></td>
            <td>Payment processing</td>
            <td>Email, billing address, plan</td>
            <td>USA (PCI-DSS Level 1)</td>
          </tr>
          <tr>
            <td><strong>Vercel</strong></td>
            <td>Hosting &amp; serverless functions</td>
            <td>Request logs, IP addresses</td>
            <td>USA (SOC 2 Type II)</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Legal Basis for Processing (GDPR)</h2>
      <ul>
        <li><strong>Contract</strong> — processing necessary to deliver the service you signed up for (Art. 6(1)(b))</li>
        <li><strong>Legitimate interests</strong> — security monitoring, fraud prevention, aggregate analytics (Art. 6(1)(f))</li>
        <li><strong>Consent</strong> — marketing communications; you may withdraw at any time (Art. 6(1)(a))</li>
        <li><strong>Legal obligation</strong> — compliance with applicable law (Art. 6(1)(c))</li>
      </ul>

      <h2>6. Data Retention</h2>
      <ul>
        <li><strong>Account data</strong> — retained for the life of your account plus 90 days after deletion</li>
        <li><strong>Campaign &amp; video data</strong> — retained for the life of your account; deleted within 30 days of account closure</li>
        <li><strong>Server logs</strong> — retained for 90 days for security and debugging</li>
        <li><strong>Billing records</strong> — retained for 7 years to comply with financial regulations</li>
      </ul>

      <h2>7. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of personal data we hold about you</li>
        <li><strong>Rectification</strong> — correct inaccurate data</li>
        <li><strong>Erasure</strong> — request deletion of your data ("right to be forgotten")</li>
        <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
        <li><strong>Restriction</strong> — limit how we process your data while a dispute is resolved</li>
        <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
        <li><strong>Opt-out of sale</strong> — California residents may opt out of the sale or sharing of personal information (CCPA)</li>
      </ul>
      <p>
        To exercise any right, email <a href="mailto:privacy@promoiq.com">privacy@promoiq.com</a>. We will respond within 30 days. We do not charge a fee for reasonable requests.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        PromoIQ is based in the United States. If you access the service from the European Economic Area (EEA) or United Kingdom, your data may be transferred to and processed in the US. We rely on Standard Contractual Clauses (SCCs) approved by the European Commission and the UK Addendum where applicable.
      </p>

      <h2>9. Security</h2>
      <p>
        We implement industry-standard safeguards including TLS encryption in transit, AES-256 encryption at rest, row-level security (RLS) on our database, and strict access controls. However, no system is completely immune from breach. We will notify affected users and relevant authorities within 72 hours of discovering a material data breach as required by GDPR Art. 33.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        PromoIQ is not directed at children under 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us and we will delete it promptly.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this policy periodically. We will notify you via email or an in-app banner for material changes. Continued use of the service after the effective date constitutes acceptance of the revised policy.
      </p>

      <h2>12. Contact</h2>
      <p>
        PromoIQ Privacy Team<br />
        <a href="mailto:privacy@promoiq.com">privacy@promoiq.com</a>
      </p>
    </LegalLayout>
  )
}
