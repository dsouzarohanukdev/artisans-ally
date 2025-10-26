import Navbar from '@/components/Navbar';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="font-sans container mx-auto p-4 md:p-8 bg-white min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-8">Privacy Policy</h1>
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p><strong>Last updated: October 26, 2025</strong></p>
            
            <p>
              Your privacy is important to us. This Privacy Policy explains how Artisan's Ally ("we", "us", or "our") collects, uses, and discloses information about you when you use our website (the "Service").
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">1. Information We Collect</h2>
            <p>
              We only collect information you voluntarily provide to us:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <strong>Account Information:</strong> When you register for an account, we collect your email address and a hashed version of your password. We also store your preferred currency.
              </li>
              <li>
                <strong>Workshop Data:</strong> We store the data you provide for your workshop, including material names and costs, and product recipes. This data is considered private to your account.
              </li>
              <li>
                <strong>API Keys:</strong> If you connect to third-party services like eBay, we securely store the authentication tokens (refresh tokens) provided by that service. We never see or store your eBay password.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Provide, maintain, and improve our Service.</li>
              <li>Authenticate you and secure your account.</li>
              <li>Communicate with you, including sending password reset emails via our email provider (Brevo).</li>
              <li>Perform the core functions of the app, such as calculating your product costs and analyzing market data on your behalf.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">3. How We Share Your Information</h2>
            <p>
              We do not and will not sell, rent, or share your personal information or your private workshop data with any third party, except as described below:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <strong>With Third-Party Services You Authorize:</strong> When you connect your eBay account, we send requests to eBay's API on your behalf. We only send the information necessary to perform the requested action (e.g., creating a draft listing).
              </li>
              <li>
                **For Email Delivery:** We use Brevo to send transactional emails (like password resets). We provide your email address to this service only for the purpose of sending that email.
              </li>
              <li>
                <strong>For Legal Reasons:</strong> We may disclose information if required to do so by law or in response to a valid request from a law enforcement agency.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">4. Data Security</h2>
            <p>
              We take reasonable measures to protect your information. Your password is never stored in plain text; it is hashed using industry-standard bcrypt. All API keys and tokens are stored securely.
            </p>
            
            <h2 className="text-2xl font-semibold text-gray-800 pt-4">5. Data Retention</h2>
            <p>
              We retain your account information and workshop data as long as your account is active. You can delete your account and all associated data at any time by contacting us.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">6. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 pt-4">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us via the form on our "About Us" page.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}