import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { SearchableSelect } from '@/components/searchable-select';
import { api, getApiErrorMessage } from '@/lib/api';
import './leading-page.css';

const DESTINATIONS = ['USA', 'UK', 'Both / Not Sure'] as const;
const STUDY_LEVELS = ["Bachelor's", "Master's", 'MBA', 'PhD', 'Diploma / Other'] as const;
const INTAKES = ['Spring', 'Fall', 'Other'] as const;
const QUALIFICATIONS = [
  'Secondary school / O Levels',
  'Higher secondary / A Levels',
  'Diploma / Associate degree',
  "Bachelor's degree",
  "Master's degree",
  'Other',
] as const;
const ENGLISH_STATUSES = ['Not Taken', 'Planning to Take', 'Taken'] as const;
const BUDGETS = [
  'Under $20,000',
  '$20,000–$30,000',
  '$30,000–$40,000',
  '$40,000+',
  'Not Sure',
] as const;
const SERVICES = [
  'University Selection',
  'Application Processing',
  'Scholarships',
  'SOP / LOR',
  'IELTS / Test Preparation',
  'Visa Guidance',
  'Education Loan',
  'Complete Guidance',
] as const;
const CONTACT_METHODS = ['Phone Call', 'WhatsApp', 'Video Call', 'Office Visit'] as const;

function toOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

const STUDY_LEVEL_OPTIONS = toOptions(STUDY_LEVELS);
const INTAKE_OPTIONS = toOptions(INTAKES);
const QUALIFICATION_OPTIONS = toOptions(QUALIFICATIONS);
const ENGLISH_STATUS_OPTIONS = toOptions(ENGLISH_STATUSES);
const BUDGET_OPTIONS = toOptions(BUDGETS);
const CONTACT_METHOD_OPTIONS = toOptions(CONTACT_METHODS);

type LeadFormState = {
  name: string;
  phone: string;
  email: string;
  city: string;
  preferred_country: string;
  study_level: string;
  intended_program: string;
  preferred_intake: string;
  intake_year: string;
  qualification: string;
  grade: string;
  english_status: string;
  english_score: string;
  budget_range: string;
  services: string[];
  contact_method: string;
  contact_time: string;
};

const INITIAL: LeadFormState = {
  name: '',
  phone: '',
  email: '',
  city: '',
  preferred_country: '',
  study_level: '',
  intended_program: '',
  preferred_intake: '',
  intake_year: '',
  qualification: '',
  grade: '',
  english_status: '',
  english_score: '',
  budget_range: '',
  services: [],
  contact_method: '',
  contact_time: '',
};

export function LeadingPage() {
  const [form, setForm] = useState<LeadFormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const showEnglishScore = form.english_status === 'Taken';

  const summary = useMemo(
    () => [
      ['Full name', form.name],
      ['Phone', form.phone],
      ['Email', form.email],
      ['City', form.city],
      ['Destination', form.preferred_country],
      ['Study level', form.study_level],
      ['Program', form.intended_program],
      ['Intake', `${form.preferred_intake} ${form.intake_year}`.trim()],
      ['Qualification', form.qualification],
      ['CGPA / percentage', form.grade],
      ['English test', form.english_status || '—'],
      ['Test score', form.english_score || '—'],
      ['Budget', form.budget_range],
      ['Services', form.services.join(', ') || '—'],
      ['Contact method', form.contact_method || '—'],
      ['Contact time', form.contact_time || '—'],
    ],
    [form],
  );

  function update<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleService(value: string) {
    setForm((current) => ({
      ...current,
      services: current.services.includes(value)
        ? current.services.filter((item) => item !== value)
        : [...current.services, value],
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.preferred_country) {
      setError('Select a preferred study destination.');
      return;
    }
    if (!form.study_level) {
      setError('Select an intended level of study.');
      return;
    }
    if (!form.preferred_intake) {
      setError('Select a preferred intake.');
      return;
    }
    if (!form.qualification) {
      setError('Select your highest qualification.');
      return;
    }
    if (!form.budget_range) {
      setError('Select an estimated annual budget.');
      return;
    }
    if (form.services.length === 0) {
      setError('Select at least one counselling service.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/leads', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        preferred_country: form.preferred_country,
        study_level: form.study_level,
        intended_program: form.intended_program.trim(),
        preferred_intake: form.preferred_intake,
        intake_year: Number(form.intake_year),
        qualification: form.qualification,
        grade: form.grade.trim(),
        english_status: form.english_status || null,
        english_score: showEnglishScore ? form.english_score.trim() || null : null,
        budget_range: form.budget_range,
        services: form.services,
        contact_method: form.contact_method || null,
        contact_time: form.contact_time.trim() || null,
        source: 'leading_page',
      });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the enquiry.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="enquiry-page">
      <div className="enquiry-atmosphere" aria-hidden="true" />

      <header className="enquiry-header">
        <Link className="enquiry-brand" to="/" aria-label="Fast Consultants home">
          <img
            className="enquiry-brand-logo"
            src="/favicon.png"
            alt="Fast Consultants"
            width={44}
            height={44}
          />
          <span className="enquiry-brand-copy">
            <span className="enquiry-brand-name">Fast Consultants</span>
            <span className="enquiry-brand-tag">Study abroad counselling</span>
          </span>
        </Link>
      </header>

      <main className="enquiry-main">
        <section className="enquiry-form-panel" aria-labelledby="enquiry-form-title">
          <div className="enquiry-form-head">
            <div>
              <p className="enquiry-form-kicker" id="enquiry-form-title">
                Lead intake
              </p>
              <p className="enquiry-form-note">Fields marked <span className="enquiry-req">*</span> are required</p>
            </div>
            <div className="enquiry-form-seal">
              <img src="/favicon.png" alt="" width={28} height={28} />
              <span>Fast Consultants</span>
            </div>
          </div>

          {done ? (
            <section className="enquiry-complete" tabIndex={-1}>
              <div className="enquiry-success-mark" aria-hidden="true">
                <img src="/favicon.png" alt="" width={36} height={36} />
              </div>
              <p className="enquiry-form-kicker">Enquiry received</p>
              <h2>Thank you — Fast Consultants has your details</h2>
              <p className="enquiry-intro">
                Our admissions team will review your enquiry. If you’re a good fit, we’ll create your
                student login and share the credentials with you.
              </p>
              <dl className="enquiry-summary">
                {summary.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                className="enquiry-primary"
                onClick={() => {
                  setDone(false);
                  setForm(INITIAL);
                }}>
                Submit another enquiry
              </button>
            </section>
          ) : (
            <form id="lead-form" onSubmit={onSubmit} noValidate>
              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>01</span>
                  <h2>Contact information</h2>
                </div>
                <div className="enquiry-grid">
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Full name <span className="enquiry-req">*</span></span>
                    <input
                      required
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">WhatsApp / phone number <span className="enquiry-req">*</span></span>
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      placeholder="e.g. +92 300 1234567"
                      value={form.phone}
                      onChange={(event) => update('phone', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Email address <span className="enquiry-req">*</span></span>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(event) => update('email', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Current city <span className="enquiry-req">*</span></span>
                    <input
                      required
                      maxLength={100}
                      autoComplete="address-level2"
                      placeholder="Enter your city"
                      value={form.city}
                      onChange={(event) => update('city', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>02</span>
                  <h2>Study plans</h2>
                </div>
                <fieldset>
                  <legend>Preferred study destination <span className="enquiry-req">*</span></legend>
                  <div className="enquiry-choices enquiry-three">
                    {DESTINATIONS.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="destination"
                          required
                          checked={form.preferred_country === option}
                          onChange={() => update('preferred_country', option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="enquiry-grid">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Intended level of study <span className="enquiry-req">*</span></span>
                    <SearchableSelect
                      searchable={false}
                      value={form.study_level}
                      options={STUDY_LEVEL_OPTIONS}
                      placeholder="Select degree level"
                      ariaLabel="Intended level of study"
                      onChange={(value) => update('study_level', value)}
                    />
                  </div>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Intended field / program <span className="enquiry-req">*</span></span>
                    <input
                      required
                      placeholder="e.g. Computer Science"
                      value={form.intended_program}
                      onChange={(event) => update('intended_program', event.target.value)}
                    />
                  </label>
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Preferred intake <span className="enquiry-req">*</span></span>
                    <SearchableSelect
                      searchable={false}
                      value={form.preferred_intake}
                      options={INTAKE_OPTIONS}
                      placeholder="Select intake"
                      ariaLabel="Preferred intake"
                      onChange={(value) => update('preferred_intake', value)}
                    />
                  </div>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Target intake year <span className="enquiry-req">*</span></span>
                    <input
                      required
                      type="number"
                      min={2026}
                      max={2100}
                      placeholder="e.g. 2027"
                      value={form.intake_year}
                      onChange={(event) => update('intake_year', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>03</span>
                  <h2>Academic profile</h2>
                </div>
                <div className="enquiry-grid">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Highest qualification <span className="enquiry-req">*</span></span>
                    <SearchableSelect
                      searchable={false}
                      value={form.qualification}
                      options={QUALIFICATION_OPTIONS}
                      placeholder="Select qualification"
                      ariaLabel="Highest qualification"
                      onChange={(value) => update('qualification', value)}
                    />
                  </div>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">CGPA / percentage <span className="enquiry-req">*</span></span>
                    <input
                      required
                      placeholder="e.g. 3.4 / 4.0 or 82%"
                      value={form.grade}
                      onChange={(event) => update('grade', event.target.value)}
                    />
                  </label>
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">IELTS / PTE / TOEFL status</span>
                    <SearchableSelect
                      searchable={false}
                      value={form.english_status}
                      options={ENGLISH_STATUS_OPTIONS}
                      placeholder="Select test status"
                      ariaLabel="English test status"
                      onChange={(value) => update('english_status', value)}
                    />
                  </div>
                  {showEnglishScore ? (
                    <label className="enquiry-field">
                      <span className="enquiry-field-label">Test name & score</span>
                      <input
                        placeholder="e.g. IELTS — 7.0 overall"
                        value={form.english_score}
                        onChange={(event) => update('english_score', event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
              </section>

              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>04</span>
                  <h2>Counselling preferences</h2>
                </div>
                <div className="enquiry-grid enquiry-grid-single">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Estimated annual budget <span className="enquiry-req">*</span></span>
                    <SearchableSelect
                      searchable={false}
                      value={form.budget_range}
                      options={BUDGET_OPTIONS}
                      placeholder="Select budget in USD"
                      ariaLabel="Estimated annual budget"
                      onChange={(value) => update('budget_range', value)}
                    />
                  </div>
                </div>

                <fieldset className="enquiry-services-field">
                  <legend>What would you like help with? <span className="enquiry-req">*</span></legend>
                  <div className="enquiry-choices enquiry-services">
                    {SERVICES.map((option) => (
                      <label key={option}>
                        <input
                          type="checkbox"
                          checked={form.services.includes(option)}
                          onChange={() => toggleService(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="enquiry-grid">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Preferred counselling mode</span>
                    <SearchableSelect
                      searchable={false}
                      value={form.contact_method}
                      options={CONTACT_METHOD_OPTIONS}
                      placeholder="Select contact method"
                      ariaLabel="Preferred counselling mode"
                      onChange={(value) => update('contact_method', value)}
                    />
                  </div>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Preferred contact time</span>
                    <input
                      placeholder="e.g. Weekdays, 4–6 pm (Pakistan time)"
                      value={form.contact_time}
                      onChange={(event) => update('contact_time', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              {error ? (
                <p className="enquiry-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="enquiry-actions">
                <p className="enquiry-privacy">
                  By submitting, you agree to be contacted by Fast Consultants about your study
                  plans.
                </p>
                <button className="enquiry-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit enquiry'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <footer className="enquiry-footer">
        <div className="enquiry-footer-brand">
          <img src="/favicon.png" alt="" width={22} height={22} />
          <span>Fast Consultants</span>
        </div>
        <span>Lead intake student enquiry</span>
      </footer>
    </div>
  );
}
