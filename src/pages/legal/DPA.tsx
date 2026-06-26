import LegalLayout from '../../components/LegalLayout'

export default function DataProcessingAgreement() {
  return (
    <LegalLayout title="Data Processing Agreement" lastUpdated="June 26, 2025">
      <div className="callout">
        This DPA supplements our Terms of Service and applies where PromoIQ processes personal data on your behalf as a data processor (e.g. when you are a business subject to GDPR, UK GDPR, or similar laws).
      </div>

      <h2>1. Definitions</h2>
      <ul>
        <li><strong>"Controller"</strong> means you (the customer), the entity that determines the purposes and means of processing personal data</li>
        <li><strong>"Processor"</strong> means PromoIQ, processing personal data on your behalf</li>
        <li><strong>"Sub-processor"</strong> means any third party engaged by PromoIQ to process personal data in connection with the Service</li>
        <li><strong>"Personal Data"</strong> has the meaning given in applicable Data Protection Law</li>
        <li><strong>"Data Protection Law"</strong> means GDPR (EU) 2016/679, UK GDPR, and any other applicable data protection legislation</li>
        <li><strong>"Processing"</strong> has the meaning given in applicable Data Protection Law</li>
        <li><strong>"Data Subject"</strong> means any identified or identifiable natural person whose personal data is processed</li>
      </ul>

      <h2>2. Scope and Roles</h2>
      <p>
        This DPA applies where PromoIQ processes personal data that you, as Controller, submit to the Service. PromoIQ processes such data only as a Processor acting on your documented instructions (as set out in the Terms of Service and this DPA) and not for its own independent purposes.
      </p>
      <p>
        Where PromoIQ processes personal data for its own purposes (e.g. account management, billing, platform security), it acts as an independent Controller and this DPA does not apply to that processing.
      </p>

      <h2>3. Your Instructions</h2>
      <p>
        PromoIQ shall process personal data only on your documented instructions. The subject matter, nature, duration, and purpose of processing are as described in the Terms of Service and as further specified by your use of the Service. PromoIQ shall inform you if it believes any instruction infringes Data Protection Law.
      </p>

      <h2>4. Confidentiality</h2>
      <p>
        PromoIQ ensures that persons authorised to process personal data are bound by appropriate confidentiality obligations. PromoIQ shall not disclose personal data to third parties except as required by law or as authorised under this DPA.
      </p>

      <h2>5. Security Measures</h2>
      <p>
        PromoIQ implements and maintains technical and organisational measures appropriate to the risk, including:
      </p>
      <ul>
        <li>TLS 1.2+ encryption for all data in transit</li>
        <li>AES-256 encryption for data at rest</li>
        <li>Row-level security (RLS) policies ensuring tenant data isolation</li>
        <li>Access controls based on the principle of least privilege</li>
        <li>Multi-factor authentication requirements for production system access</li>
        <li>Automated vulnerability scanning and dependency auditing</li>
        <li>Audit logging of access to personal data</li>
        <li>Formal incident response and breach notification procedures</li>
        <li>Regular security reviews and penetration testing</li>
      </ul>

      <h2>6. Sub-Processors</h2>

      <h3>6.1 Authorisation</h3>
      <p>
        You grant PromoIQ general authorisation to engage the sub-processors listed below. PromoIQ shall impose data protection obligations on sub-processors equivalent to those in this DPA and remains responsible for sub-processor acts and omissions.
      </p>

      <h3>6.2 Current Sub-Processors</h3>
      <table>
        <thead>
          <tr>
            <th>Sub-processor</th>
            <th>Function</th>
            <th>Personal Data</th>
            <th>Location</th>
            <th>Transfer Mechanism</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Clerk, Inc.</strong></td>
            <td>Authentication &amp; identity management</td>
            <td>Name, email, session data</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Supabase, Inc.</strong></td>
            <td>Database &amp; backend</td>
            <td>Campaign data, user IDs, scene metadata</td>
            <td>USA / EU</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Anthropic PBC</strong></td>
            <td>AI script generation</td>
            <td>Product descriptions, prompts</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Higgsfield AI, Inc.</strong></td>
            <td>Video rendering</td>
            <td>Product image URLs, director prompts</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Arcads AI</strong></td>
            <td>Video rendering (optional)</td>
            <td>Product image URLs, director prompts</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Stripe, Inc.</strong></td>
            <td>Payment processing</td>
            <td>Email, billing address</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
          <tr>
            <td><strong>Netlify, Inc.</strong></td>
            <td>Hosting &amp; serverless compute</td>
            <td>IP addresses, request logs</td>
            <td>USA</td>
            <td>SCCs / DPA</td>
          </tr>
        </tbody>
      </table>

      <h3>6.3 Changes to Sub-Processors</h3>
      <p>
        PromoIQ will provide at least 14 days' advance notice before adding or replacing a sub-processor by updating this page and notifying you by email. You may object in writing within 14 days. If the objection cannot be resolved, either party may terminate the affected Service with 30 days' notice.
      </p>

      <h2>7. Data Subject Rights</h2>
      <p>
        PromoIQ shall, to the extent technically feasible and within legally required timeframes, assist you in responding to Data Subject requests to exercise rights under Data Protection Law (access, rectification, erasure, restriction, portability, objection). Such assistance shall be provided at our standard hourly support rate for requests requiring significant engineering effort beyond self-service tooling.
      </p>

      <h2>8. Data Breach Notification</h2>
      <p>
        PromoIQ shall notify you without undue delay (and in any event within 72 hours of becoming aware) of any confirmed or reasonably suspected personal data breach affecting your data. Notification shall include, to the extent known at the time: the nature of the breach; categories and approximate number of data subjects and records affected; likely consequences; and measures taken or proposed to address the breach.
      </p>

      <h2>9. Data Protection Impact Assessments</h2>
      <p>
        PromoIQ shall provide reasonable assistance to help you conduct data protection impact assessments (DPIAs) and prior consultations with supervisory authorities, where required by Data Protection Law and where such processing relates to the Service.
      </p>

      <h2>10. Deletion and Return of Data</h2>
      <p>
        Upon termination or expiry of the Service, and upon your written request, PromoIQ shall delete or return all personal data within 30 days, except to the extent retention is required by applicable law. PromoIQ shall certify in writing that deletion has been completed upon request.
      </p>

      <h2>11. Audits and Compliance</h2>
      <p>
        PromoIQ shall make available all information reasonably necessary to demonstrate compliance with Data Protection Law and this DPA. PromoIQ shall allow for and contribute to audits conducted by you or your appointed auditor, provided that: (a) audits are conducted on reasonable notice (minimum 30 days); (b) no more than once per calendar year unless a breach is confirmed; (c) you bear the cost of the audit; and (d) the auditor is bound by appropriate confidentiality obligations.
      </p>

      <h2>12. International Transfers</h2>
      <p>
        Where personal data is transferred from the EEA or UK to a third country, PromoIQ relies on the Standard Contractual Clauses (Module 2: Controller to Processor) adopted by the European Commission in Decision 2021/914, and the UK Addendum (as issued by the UK ICO) where applicable. These are incorporated into this DPA by reference. By entering into this DPA you are deemed to have executed the SCCs and UK Addendum.
      </p>

      <h2>13. Liability</h2>
      <p>
        Each party's liability under this DPA is subject to the limitations set out in the Terms of Service. Nothing in this DPA limits liability to Data Subjects or supervisory authorities as required by Data Protection Law.
      </p>

      <h2>14. Term</h2>
      <p>
        This DPA is effective from the date you accept the Terms of Service and remains in force for as long as PromoIQ processes personal data on your behalf. Obligations relating to security, confidentiality, and data return survive termination.
      </p>

      <h2>15. Entire Agreement</h2>
      <p>
        This DPA forms part of and is governed by the Terms of Service between you and PromoIQ. In the event of conflict between this DPA and the Terms of Service on matters of data protection, this DPA shall prevail.
      </p>

      <h2>16. Contact</h2>
      <p>
        For DPA queries or to submit a data subject request:<br />
        <a href="mailto:dpa@promoiq.com">dpa@promoiq.com</a>
      </p>
    </LegalLayout>
  )
}
