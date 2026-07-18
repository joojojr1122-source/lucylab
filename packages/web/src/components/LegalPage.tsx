export function LegalPage({
  kind,
  onBack,
}: {
  kind: "terms" | "privacy";
  onBack: () => void;
}) {
  return (
    <div className="legal">
      <button className="leave" onClick={onBack}>
        ← Back
      </button>
      {kind === "terms" ? (
        <>
          <h1>Terms of Service</h1>
          <p className="updated">Last updated: 2026-07-18</p>
          <h2>1. Acceptable use</h2>
          <p>
            You may use Lucy to transform your webcam with avatars, generated faces, characters,
            and your own stylized self. You must not use the service to impersonate real people
            without their explicit consent, to deceive others, or for any unlawful purpose.
          </p>
          <h2>2. Credits & billing</h2>
          <p>
            Streaming consumes credits billed per second of transformed video. New accounts
            include free trial credits. Paid top-ups are processed by Stripe; all sales are final.
            Credits do not expire.
          </p>
          <h2>3. Service availability</h2>
          <p>
            Transformation is performed by third-party infrastructure (Decart / fal). If that
            infrastructure is unavailable, affected streaming time is not deducted from your
            credits.
          </p>
          <h2>4. Termination</h2>
          <p>
            We may suspend accounts that violate these terms. You are responsible for what you
            broadcast.
          </p>
        </>
      ) : (
        <>
          <h1>Privacy Policy</h1>
          <p className="updated">Last updated: 2026-07-18</p>
          <h2>1. What we process</h2>
          <p>
            Your webcam frames are sent to our transformation provider (fal / Decart) to produce
            the transformed video. We do not permanently store your video frames.
          </p>
          <h2>2. Account & payment data</h2>
          <p>
            Payments are handled by Stripe. We store only a per-client credit balance and your
            Terms acceptance; we do not store card numbers.
          </p>
          <h2>3. Identifiers</h2>
          <p>
            A random client identifier is stored in your browser and used to meter credits. No
            account or KYC is required to use the service.
          </p>
        </>
      )}
    </div>
  );
}
