import LegalLayout from '../../components/LegalLayout'

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="June 26, 2025">
      <div className="callout">
        By creating an account or using PromoIQ you agree to these Terms. Please read them — they include important limitations on liability and rights to AI-generated content.
      </div>

      <h2>1. Acceptance of Terms</h2>
      <p>
        These Terms of Service ("Terms") govern your access to and use of the PromoIQ platform, website, APIs, and related services (collectively, "Service") operated by PromoIQ ("we", "us", or "our"). By registering for an account, clicking "I agree", or otherwise accessing the Service, you agree to be bound by these Terms and our Privacy Policy.
      </p>
      <p>
        If you are using the Service on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.
      </p>

      <h2>2. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old to use the Service</li>
        <li>You must provide accurate registration information and keep it current</li>
        <li>Accounts are personal and non-transferable unless you hold a Team or Agency plan</li>
        <li>You may not create more than one free account per person or organisation</li>
      </ul>

      <h2>3. The Service</h2>
      <p>
        PromoIQ provides an AI-powered pipeline that generates UGC-style video advertisements from product images and text descriptions. The pipeline uses third-party AI models including Anthropic Claude (for script writing) and Higgsfield (for video rendering and image generation). We act as an orchestration layer between these services and you.
      </p>
      <p>
        We do not guarantee that any generated video will achieve any particular commercial outcome, engagement rate, or advertising result. AI outputs are probabilistic and may vary between runs.
      </p>

      <h2>4. Accounts and Security</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your credentials</li>
        <li>You must notify us immediately at <a href="mailto:security@promoiq.com">security@promoiq.com</a> if you suspect unauthorised access to your account</li>
        <li>We are not liable for losses resulting from compromised credentials where you failed to notify us promptly</li>
        <li>We may suspend or terminate accounts that show signs of compromise or abuse</li>
      </ul>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Generate content that is defamatory, harassing, threatening, or hateful toward any individual or group</li>
        <li>Create deceptive advertisements, fake testimonials, or misleading claims about any product or person</li>
        <li>Produce content that sexually exploits or depicts minors (CSAM) — strictly prohibited and reported to authorities</li>
        <li>Infringe third-party intellectual property rights, including using images you do not own or have rights to</li>
        <li>Generate content that impersonates real people without consent, including deepfakes</li>
        <li>Violate any applicable advertising standards, regulations, or platform policies (Meta, TikTok, Google Ads, etc.)</li>
        <li>Reverse engineer, decompile, or extract our source code, models, or proprietary algorithms</li>
        <li>Use automated scripts, bots, or bulk processing tools against our API without an enterprise agreement</li>
        <li>Resell, sublicense, or white-label the Service without written permission</li>
        <li>Circumvent usage limits, rate limits, or billing controls</li>
      </ul>
      <p>
        Violation of these rules may result in immediate account termination without refund and, where required, referral to law enforcement.
      </p>

      <h2>6. Intellectual Property</h2>

      <h3>6.1 Your Content</h3>
      <p>
        You retain all ownership rights to product images, brand assets, and text descriptions you submit ("Input Content"). By submitting Input Content you grant us a limited, non-exclusive, royalty-free licence to process it for the sole purpose of delivering the Service to you.
      </p>

      <h3>6.2 AI-Generated Output</h3>
      <p>
        Subject to your compliance with these Terms and payment of applicable fees, we assign to you all of our rights, title, and interest (if any) in the video outputs generated for your account ("Output Content"). You may use Output Content for any lawful commercial purpose including paid advertising.
      </p>
      <p>
        You acknowledge that: (a) AI-generated outputs are not guaranteed to be unique and similar outputs may be generated for other users; (b) we make no warranty that Output Content is free of third-party IP claims; and (c) you are solely responsible for clearing any rights relating to people, music, trademarks, or other elements that appear in Output Content.
      </p>

      <h3>6.3 PromoIQ IP</h3>
      <p>
        The Service, including our software, design, branding, prompts, and AI orchestration logic, is owned by PromoIQ and protected by applicable intellectual property law. Nothing in these Terms transfers ownership of PromoIQ IP to you.
      </p>

      <h2>7. Fees and Payment</h2>
      <ul>
        <li>Free tier users receive a limited number of video generations as stated on our Pricing page</li>
        <li>Paid plans are billed monthly or annually in advance via Stripe</li>
        <li>All fees are in USD and exclusive of applicable taxes unless stated otherwise</li>
        <li>We may change pricing with 30 days' notice; price changes do not apply to the current billing period</li>
        <li>Refunds are available within 7 days of initial purchase for annual plans if you have not used more than 5 generation credits</li>
        <li>No refunds are issued for monthly plans or if acceptable use violations are found</li>
      </ul>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED ACCESS. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR THAT AI-GENERATED OUTPUTS WILL BE ACCURATE, COMPLETE, OR SUITABLE FOR YOUR INTENDED PURPOSE.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PROMOIQ'S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM OR (B) USD $100.
      </p>
      <p>
        IN NO EVENT SHALL PROMOIQ BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOSS OF DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        Some jurisdictions do not allow exclusion of implied warranties or limitation of liability for consequential damages, so the above may not apply to you.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless PromoIQ and its officers, directors, employees, and agents from any claim, demand, loss, or expense (including reasonable legal fees) arising from: (a) your use of the Service; (b) your Input Content; (c) your Output Content and how you use it; (d) your violation of these Terms; or (e) your violation of any third-party rights.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may cancel your account at any time from the account settings page. We may suspend or terminate your account immediately and without notice if you violate these Terms, engage in fraudulent activity, or if required by law.
      </p>
      <p>
        Upon termination: (a) your right to access the Service ceases immediately; (b) we will retain your data for 30 days to allow export; (c) sections 6, 8, 9, 10, and 13 survive termination.
      </p>

      <h2>12. Third-Party Services</h2>
      <p>
        The Service integrates third-party AI and infrastructure providers (Anthropic, Higgsfield, Supabase, Stripe, Vercel). We are not responsible for the uptime, outputs, or policies of these providers. Their terms and policies apply to the portions of the pipeline they operate.
      </p>

      <h2>13. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law principles. Any dispute that cannot be resolved informally within 30 days shall be submitted to binding arbitration under the JAMS Streamlined Arbitration Rules. You waive any right to a jury trial or class action. Nothing prevents either party from seeking injunctive relief in court.
      </p>

      <h2>14. Changes to Terms</h2>
      <p>
        We may modify these Terms at any time. We will provide at least 14 days' notice via email or in-app notification for material changes. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        PromoIQ Legal<br />
        <a href="mailto:legal@promoiq.com">legal@promoiq.com</a>
      </p>
    </LegalLayout>
  )
}
