import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { SearchableSelect } from '@/components/searchable-select';
import { api, getApiErrorMessage } from '@/lib/api';
import './leading-page.css';

const DESTINATIONS = ['USA', 'Other'] as const;
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
const ENGLISH_TESTS = ['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'Other'] as const;
const BUDGETS = [
  'Under $20,000',
  '$20,000–$30,000',
  '$30,000–$40,000',
  '$40,000+',
  'Not Sure',
] as const;
const VISA_REFUSAL_OPTIONS = ['No', 'Yes'] as const;
const MARITAL_STATUS_OPTIONS = ['Single', 'Married'] as const;

function toOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

function englishScorePlaceholder(test: string) {
  switch (test) {
    case 'IELTS':
      return 'e.g. 7.0 overall';
    case 'TOEFL':
      return 'e.g. 95';
    case 'PTE':
      return 'e.g. 65';
    case 'Duolingo':
      return 'e.g. 120';
    default:
      return 'Enter your score or grade';
  }
}

const STUDY_LEVEL_OPTIONS = toOptions(STUDY_LEVELS);
const INTAKE_OPTIONS = toOptions(INTAKES);
const QUALIFICATION_OPTIONS = toOptions(QUALIFICATIONS);
const BUDGET_OPTIONS = toOptions(BUDGETS);

type EnglishTestEntry = {
  test: string;
  score: string;
};

type LeadFormState = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  visa_refusal: string;
  marital_status: string;
  date_of_birth: string;
  preferred_country: string;
  preferred_country_other: string;
  study_level: string;
  intended_program: string;
  preferred_intake: string;
  intake_year: string;
  qualification: string;
  grade: string;
  passing_year: string;
  english_tests: EnglishTestEntry[];
  english_draft_test: string;
  english_draft_score: string;
  travel_history: string;
  budget_range: string;
};

const INITIAL: LeadFormState = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  city: '',
  address: '',
  visa_refusal: '',
  marital_status: '',
  date_of_birth: '',
  preferred_country: '',
  preferred_country_other: '',
  study_level: '',
  intended_program: '',
  preferred_intake: '',
  intake_year: '',
  qualification: '',
  grade: '',
  passing_year: '',
  english_tests: [],
  english_draft_test: '',
  english_draft_score: '',
  travel_history: '',
  budget_range: '',
};

export function LeadingPage() {
  const [form, setForm] = useState<LeadFormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const availableEnglishTests = useMemo(
    () =>
      ENGLISH_TESTS.filter(
        (test) => !form.english_tests.some((entry) => entry.test === test),
      ).map((test) => ({ value: test, label: test })),
    [form.english_tests],
  );

  const englishSummary =
    form.english_tests.length > 0
      ? form.english_tests
          .map((entry) =>
            entry.score.trim() ? `${entry.test} — ${entry.score.trim()}` : entry.test,
          )
          .join('; ')
      : 'Not Taken';

  const summary = useMemo(
    () => [
      ['Full name', form.name],
      ['Mobile', form.phone],
      ['WhatsApp', form.whatsapp || '—'],
      ['Email', form.email],
      ['Date of birth', form.date_of_birth || '—'],
      ['Visa refusal', form.visa_refusal || '—'],
      ['Marital status', form.marital_status || '—'],
      ['City', form.city],
      ['Address', form.address || '—'],
      [
        'Destination',
        form.preferred_country === 'Other'
          ? form.preferred_country_other.trim() || 'Other'
          : form.preferred_country,
      ],
      ['Study level', form.study_level],
      ['Program', form.intended_program],
      ['Intake', `${form.preferred_intake} ${form.intake_year}`.trim()],
      ['Qualification', form.qualification],
      ['CGPA / percentage', form.grade],
      ['Passing year', form.passing_year || '—'],
      ['English tests', englishSummary],
      ['Travel history', form.travel_history || '—'],
      ['Budget', form.budget_range],
    ],
    [form, englishSummary],
  );

  function update<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addEnglishTest() {
    const test = form.english_draft_test;
    const score = form.english_draft_score.trim();
    if (!test) {
      setError('Select an English test to add.');
      return;
    }
    if (!score) {
      setError(`Enter your ${test} score.`);
      return;
    }
    if (form.english_tests.some((entry) => entry.test === test)) {
      setError(`${test} is already added.`);
      return;
    }

    setError(null);
    setForm((current) => ({
      ...current,
      english_tests: [...current.english_tests, { test, score }],
      english_draft_test: '',
      english_draft_score: '',
    }));
  }

  function removeEnglishTest(test: string) {
    setForm((current) => ({
      ...current,
      english_tests: current.english_tests.filter((entry) => entry.test !== test),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.preferred_country) {
      setError('Select a preferred study destination.');
      return;
    }
    if (form.preferred_country === 'Other' && !form.preferred_country_other.trim()) {
      setError('Enter your preferred study destination.');
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
    if (form.english_draft_test) {
      setError('Add or clear the English test draft before submitting.');
      return;
    }

    const englishTests = form.english_tests.map((entry) => ({
      test: entry.test,
      score: entry.score.trim(),
    }));

    setSubmitting(true);
    try {
      await api.post('/leads', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim(),
        city: form.city.trim(),
        address: form.address.trim() || null,
        visa_refusal: form.visa_refusal || null,
        marital_status: form.marital_status || null,
        date_of_birth: form.date_of_birth || null,
        preferred_country:
          form.preferred_country === 'Other'
            ? form.preferred_country_other.trim()
            : form.preferred_country,
        study_level: form.study_level,
        intended_program: form.intended_program.trim(),
        preferred_intake: form.preferred_intake,
        intake_year: Number(form.intake_year),
        qualification: form.qualification,
        grade: form.grade.trim(),
        passing_year: form.passing_year.trim() || null,
        english_tests: englishTests,
        english_status:
          englishTests.length > 0
            ? englishTests.map((entry) => entry.test).join(', ')
            : 'Not Taken',
        english_score:
          englishTests.length > 0
            ? englishTests.map((entry) => `${entry.test}: ${entry.score}`).join('; ')
            : null,
        travel_history: form.travel_history.trim() || null,
        budget_range: form.budget_range,
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
                className="primary-btn enquiry-primary"
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
                <div className="enquiry-grid enquiry-grid-single">
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
                    <span className="enquiry-field-hint">
                      Please type your full name as per CNIC / Passport
                    </span>
                  </label>
                </div>

                <div className="enquiry-grid">
                  <fieldset>
                    <legend>Visa refusal</legend>
                    <div className="enquiry-choices enquiry-two">
                      {VISA_REFUSAL_OPTIONS.map((option) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name="visa_refusal"
                            checked={form.visa_refusal === option}
                            onChange={() => update('visa_refusal', option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Marital status</legend>
                    <div className="enquiry-choices enquiry-two">
                      {MARITAL_STATUS_OPTIONS.map((option) => (
                        <label key={option}>
                          <input
                            type="radio"
                            name="marital_status"
                            checked={form.marital_status === option}
                            onChange={() => update('marital_status', option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
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
                    <span className="enquiry-field-label">Date of birth</span>
                    <input
                      type="date"
                      autoComplete="bday"
                      value={form.date_of_birth}
                      onChange={(event) => update('date_of_birth', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Mobile <span className="enquiry-req">*</span></span>
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
                    <span className="enquiry-field-label">WhatsApp</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="e.g. +92 300 1234567"
                      value={form.whatsapp}
                      onChange={(event) => update('whatsapp', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Address</span>
                    <input
                      maxLength={255}
                      autoComplete="street-address"
                      placeholder="Street, area, city"
                      value={form.address}
                      onChange={(event) => update('address', event.target.value)}
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
                  <div className="enquiry-choices enquiry-two">
                    {DESTINATIONS.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="destination"
                          required
                          checked={form.preferred_country === option}
                          onChange={() => {
                            setForm((current) => ({
                              ...current,
                              preferred_country: option,
                              preferred_country_other:
                                option === 'Other' ? current.preferred_country_other : '',
                            }));
                          }}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {form.preferred_country === 'Other' ? (
                  <div className="enquiry-grid enquiry-grid-single">
                    <label className="enquiry-field">
                      <span className="enquiry-field-label">
                        Specify destination <span className="enquiry-req">*</span>
                      </span>
                      <input
                        required
                        maxLength={120}
                        placeholder="e.g. Canada, Australia, Germany"
                        value={form.preferred_country_other}
                        onChange={(event) =>
                          update('preferred_country_other', event.target.value)
                        }
                      />
                    </label>
                  </div>
                ) : null}
                <div className="enquiry-grid">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Level of study <span className="enquiry-req">*</span></span>
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
                    <span className="enquiry-field-label">Course / program interested <span className="enquiry-req">*</span></span>
                    <input
                      required
                      placeholder="e.g. Computer Science"
                      value={form.intended_program}
                      onChange={(event) => update('intended_program', event.target.value)}
                    />
                  </label>
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
                </div>
              </section>

              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>03</span>
                  <h2>Academic profile</h2>
                </div>
                <div className="enquiry-grid">
                  <div className="enquiry-field">
                    <span className="enquiry-field-label">Last qualification <span className="enquiry-req">*</span></span>
                    <SearchableSelect
                      searchable={false}
                      value={form.qualification}
                      options={QUALIFICATION_OPTIONS}
                      placeholder="Select qualification"
                      ariaLabel="Last qualification"
                      onChange={(value) => update('qualification', value)}
                    />
                  </div>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Score / grade / CGPA <span className="enquiry-req">*</span></span>
                    <input
                      required
                      placeholder="e.g. 3.4 / 4.0 or 82%"
                      value={form.grade}
                      onChange={(event) => update('grade', event.target.value)}
                    />
                  </label>
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Passing year</span>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="e.g. 2024"
                      value={form.passing_year}
                      onChange={(event) => update('passing_year', event.target.value)}
                    />
                  </label>
                </div>

                <div className="enquiry-english-block">
                  <div className="enquiry-english-head">
                    <span className="enquiry-field-label">English tests</span>
                    <span className="enquiry-field-hint">
                      Add every test you have taken. Leave empty if not taken.
                    </span>
                  </div>

                  {form.english_tests.length > 0 ? (
                    <ul className="enquiry-english-list">
                      {form.english_tests.map((entry) => (
                        <li key={entry.test}>
                          <span>
                            <strong>{entry.test}</strong>
                            <span>{entry.score}</span>
                          </span>
                          <button
                            type="button"
                            className="enquiry-english-remove"
                            onClick={() => removeEnglishTest(entry.test)}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {availableEnglishTests.length > 0 ? (
                    <div className="enquiry-english-add">
                      <div className="enquiry-field">
                        <span className="enquiry-field-label">Select test</span>
                        <SearchableSelect
                          searchable={false}
                          value={form.english_draft_test}
                          options={availableEnglishTests}
                          placeholder="Choose a test"
                          ariaLabel="Select English test"
                          onChange={(value) => {
                            setForm((current) => ({
                              ...current,
                              english_draft_test: value,
                              english_draft_score: value ? current.english_draft_score : '',
                            }));
                          }}
                        />
                      </div>
                      {form.english_draft_test ? (
                        <label className="enquiry-field">
                          <span className="enquiry-field-label">
                            {form.english_draft_test} score / grade
                          </span>
                          <input
                            placeholder={englishScorePlaceholder(form.english_draft_test)}
                            value={form.english_draft_score}
                            onChange={(event) =>
                              update('english_draft_score', event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="ghost-btn btn-sm enquiry-english-add-btn"
                        disabled={!form.english_draft_test}
                        onClick={addEnglishTest}>
                        Add test
                      </button>
                    </div>
                  ) : (
                    <p className="enquiry-field-hint">All available English tests have been added.</p>
                  )}
                </div>

                <div className="enquiry-grid enquiry-grid-single">
                  <label className="enquiry-field">
                    <span className="enquiry-field-label">Travel history</span>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="Countries visited, visa types, and travel years (if any)"
                      value={form.travel_history}
                      onChange={(event) => update('travel_history', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="enquiry-step">
                <div className="enquiry-step-label">
                  <span>04</span>
                  <h2>Budget</h2>
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
                <button className="primary-btn enquiry-primary" type="submit" disabled={submitting}>
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
