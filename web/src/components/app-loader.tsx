import './app-loader.css';

type AppLoaderProps = {
  message?: string;
  /** Full viewport boot screen vs lightweight overlay */
  variant?: 'boot' | 'overlay';
};

export function AppLoader({
  message = 'Loading your workspace…',
  variant = 'boot',
}: AppLoaderProps) {
  return (
    <div
      className={`app-loader${variant === 'overlay' ? ' app-loader-overlay' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true">
      <div className="app-loader-card">
        <img className="app-loader-logo" src="/favicon.png" alt="" width={56} height={56} />
        <div className="app-loader-spinner" aria-hidden />
        <div className="app-loader-copy">
          <strong className="app-loader-brand">Fast Consultants</strong>
          <span className="app-loader-message">{message}</span>
        </div>
      </div>
    </div>
  );
}

type InlinePageLoaderProps = {
  message?: string;
};

/** Centered loader for page content while data is fetching. */
export function InlinePageLoader({ message = 'Loading page content…' }: InlinePageLoaderProps) {
  return (
    <div className="inline-page-loader panel" role="status" aria-live="polite" aria-busy="true">
      <div className="app-loader-spinner inline-page-loader-spinner" aria-hidden />
      <div className="app-loader-copy">
        <strong className="app-loader-brand">Please wait</strong>
        <span className="app-loader-message">{message}</span>
      </div>
    </div>
  );
}
