type Props = {
  kicker: string;
};

export function AuthHeroPanel({ kicker }: Props) {
  return (
    <section className="auth-hero compact">
      <div className="auth-hero-copy">
        <img className="auth-brand-logo" src="/favicon.png" alt="" width={56} height={56} />
        <p className="auth-kicker">{kicker}</p>
        <h1>Fast Consultants</h1>
      </div>
    </section>
  );
}
