import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { PastelBlobs } from '@/components/pastel-blobs';
import { ThemeToggle } from '@/components/theme-toggle';
import { rootForPortal, type Portal } from '@/lib/portals';
import './auth.css';
import './landing.css';

type PortalOption = {
  portal: Portal;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
};

const PORTALS: PortalOption[] = [
  {
    portal: 'student',
    title: 'Student',
    subtitle: 'Documents, fees, interviews, and your application status.',
    emoji: '🎓',
    tint: '#FFE8EC',
  },
  {
    portal: 'superadmin',
    title: 'Super Admin',
    subtitle: 'Full access, team permissions, and organization oversight.',
    emoji: '🛡️',
    tint: '#FFE4EA',
  },
  {
    portal: 'staff',
    title: 'Staff',
    subtitle: 'Department workspace for reviews, finance, and visa workflows.',
    emoji: '💼',
    tint: '#EEEFF4',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

/** GPU-friendly: opacity + transform only (no blur/scale on load). */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease },
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const sheetEnter = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease, delay: 0.08 },
  },
};

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const motionInitial = reduceMotion ? 'visible' : 'hidden';

  return (
    <LazyMotion features={domAnimation}>
      <div className="auth-screen landing-screen">
        <PastelBlobs />

        <m.section
          className="auth-hero landing-hero"
          initial={motionInitial}
          animate="visible"
          variants={stagger}>
          <m.div className="landing-kicker-row" variants={fadeUp}>
            <img className="auth-brand-logo" src="/favicon.png" alt="" width={56} height={56} />
            <span className="landing-kicker-line" />
            <p className="auth-kicker">Web workspace</p>
          </m.div>

          <m.h1 className="landing-title" variants={fadeUp}>
            <span className="landing-title-line">Fast</span>
            <span className="landing-title-line landing-title-accent">Consultants</span>
          </m.h1>
        </m.section>

        <m.section
          className="auth-sheet landing-sheet"
          initial={motionInitial}
          animate="visible"
          variants={sheetEnter}>
          <div className="landing-sheet-inner">
            <ThemeToggle />
            <p className="auth-sheet-hint landing-sheet-hint">Choose your workspace</p>

            <m.div
              className="role-list landing-role-list"
              initial={motionInitial}
              animate="visible"
              variants={stagger}>
              {PORTALS.map((role) => (
                <m.div key={role.portal} variants={fadeUp} className="landing-role-wrap">
                  <Link to={rootForPortal(role.portal)} className="role-card landing-role-card">
                    <span className="role-avatar landing-role-avatar" style={{ background: role.tint }}>
                      {role.emoji}
                    </span>
                    <span className="role-copy">
                      <strong>{role.title}</strong>
                      <span>{role.subtitle}</span>
                    </span>
                    <span className="role-chevron landing-role-chevron" aria-hidden>
                      ›
                    </span>
                  </Link>
                </m.div>
              ))}
            </m.div>

            <m.p
              className="landing-sheet-note"
              initial={motionInitial}
              animate="visible"
              variants={fadeIn}>
              New applicant?{' '}
              <Link to="/apply" className="landing-apply-link">
                Fill the leading form
              </Link>
              . Each portal accepts only its matching account type.
            </m.p>
          </div>
        </m.section>
      </div>
    </LazyMotion>
  );
}
