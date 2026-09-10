import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageBackButton } from '@/components/page-back-button';
import { SectionProgress } from '@/components/page-fill';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { citiesForCountry } from '@/constants/cities';
import { COUNTRIES } from '@/constants/countries';
import { api, getApiErrorMessage } from '@/lib/api';
import { uploadStudentDocument } from '@/lib/upload-student-document';
import { StudentRoutes } from '@/lib/department-routes';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, InformationCategory, StudentDocument, StudentProfile } from '@/types/auth';
import './dashboard.css';

type EducationEntry = {
  key: string;
  education_level: string;
  institution_name: string;
  field_of_study: string;
  graduation_year: string;
};

type ProfileForm = {
  name: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  country_of_residence: string;
  city: string;
  address: string;
  passport_number: string;
  cnic_number: string;
  information_category: InformationCategory | '';
  educations: EducationEntry[];
  job_title: string;
  employer_name: string;
  years_of_experience: string;
  other_information: string;
};

let educationKeySeq = 0;
function nextEducationKey(): string {
  educationKeySeq += 1;
  return `edu-${educationKeySeq}`;
}

function emptyEducation(): EducationEntry {
  return {
    key: nextEducationKey(),
    education_level: '',
    institution_name: '',
    field_of_study: '',
    graduation_year: '',
  };
}

const emptyForm: ProfileForm = {
  name: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  nationality: '',
  country_of_residence: '',
  city: '',
  address: '',
  passport_number: '',
  cnic_number: '',
  information_category: '',
  educations: [emptyEducation()],
  job_title: '',
  employer_name: '',
  years_of_experience: '',
  other_information: '',
};

const CNIC_PATTERN = /^[0-9]{5}-?[0-9]{7}-?[0-9]$/;

const EDUCATION_LEVELS = ['Matric', 'Intermediate', "Bachelor's", 'Diploma'] as const;

const SECTION_OPTIONS = [
  { value: 'personal', label: 'Personal information' },
  { value: 'education', label: 'Education information' },
  { value: 'job', label: 'Job information' },
  { value: 'other', label: 'Other' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

type EducationLevel = (typeof EDUCATION_LEVELS)[number];

function documentTypeForEducationLevel(level: string): {
  type: DocumentType;
  title: string;
} | null {
  if (level === 'Matric') return { type: 'metric', title: 'Matric certificate' };
  if (level === 'Intermediate') return { type: 'intermediate', title: 'Intermediate certificate' };
  if (level === "Bachelor's") {
    return { type: 'degree_certificate', title: "Bachelor's degree certificate" };
  }
  if (level === 'Diploma') return { type: 'diploma', title: 'Diploma certificate' };
  return null;
}

function toForm(profile: StudentProfile): ProfileForm {
  const educations =
    profile.educations && profile.educations.length > 0
      ? profile.educations.map((entry) => ({
          key: nextEducationKey(),
          education_level: entry.education_level ?? '',
          institution_name: entry.institution_name ?? '',
          field_of_study: entry.field_of_study ?? '',
          graduation_year: entry.graduation_year ?? '',
        }))
      : [
          {
            key: nextEducationKey(),
            education_level: profile.education_level ?? '',
            institution_name: profile.institution_name ?? '',
            field_of_study: profile.field_of_study ?? '',
            graduation_year: profile.graduation_year ?? '',
          },
        ];

  return {
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    nationality: profile.nationality ?? '',
    country_of_residence: profile.country_of_residence ?? '',
    city: profile.city ?? '',
    address: profile.address ?? '',
    passport_number: profile.passport_number ?? '',
    cnic_number: profile.cnic_number ?? '',
    information_category: profile.information_category ?? '',
    educations,
    job_title: profile.job_title ?? '',
    employer_name: profile.employer_name ?? '',
    years_of_experience: profile.years_of_experience ?? '',
    other_information: profile.other_information ?? '',
  };
}

function personalFields(form: ProfileForm): string[] {
  return [
    form.name,
    form.phone,
    form.date_of_birth,
    form.gender,
    form.nationality,
    form.country_of_residence,
    form.city,
    form.address,
    form.passport_number,
    form.cnic_number,
  ];
}

function educationFields(form: ProfileForm): string[] {
  return form.educations.flatMap((entry) => [
    entry.education_level,
    entry.institution_name,
    entry.field_of_study,
    entry.graduation_year,
  ]);
}

function jobFields(form: ProfileForm): string[] {
  return [form.job_title, form.employer_name, form.years_of_experience];
}

function otherFields(form: ProfileForm): string[] {
  return [form.other_information];
}

type ProfileSection = 'personal' | InformationCategory;

function sectionFields(form: ProfileForm, section: ProfileSection): string[] {
  if (section === 'education') return educationFields(form);
  if (section === 'job') return jobFields(form);
  if (section === 'other') return otherFields(form);
  return personalFields(form);
}

function sectionLabel(section: ProfileSection): string {
  if (section === 'education') return 'education';
  if (section === 'job') return 'job';
  if (section === 'other') return 'other';
  return 'personal';
}

function sectionPageTitle(section: ProfileSection): string {
  if (section === 'education') return 'Education information';
  if (section === 'job') return 'Job information';
  if (section === 'other') return 'Other information';
  return 'Personal information';
}

/** Sections read as a wizard, so back/forward step through them. */
function previousSection(section: ProfileSection): ProfileSection | null {
  if (section === 'education') return 'personal';
  if (section === 'job') return 'education';
  if (section === 'other') return 'job';
  return null;
}

function nextSection(section: ProfileSection): ProfileSection | null {
  if (section === 'personal') return 'education';
  if (section === 'education') return 'job';
  if (section === 'job') return 'other';
  return null;
}

function sectionProgress(form: ProfileForm, section: ProfileSection) {
  const fields = sectionFields(form, section);
  const total = fields.length;
  const filled = fields.filter(Boolean).length;
  const complete = total > 0 && filled >= total;
  const progressPct = total === 0 ? 0 : Math.round((filled / total) * 100);

  return { filled, total, complete, progressPct };
}

function validatePersonal(form: ProfileForm): string | null {
  if (!form.name.trim()) return 'Full name is required.';
  if (!form.phone.trim()) return 'Phone is required.';
  if (!form.date_of_birth) return 'Date of birth is required.';
  if (!form.gender) return 'Gender is required.';
  if (!form.nationality.trim()) return 'Nationality is required.';
  if (!form.country_of_residence.trim()) return 'Country of residence is required.';
  if (!form.city.trim()) return 'City is required.';
  if (!form.address.trim()) return 'Address is required.';
  if (!form.passport_number.trim()) return 'Passport number is required.';
  if (!form.cnic_number.trim()) return 'CNIC number is required.';
  if (!CNIC_PATTERN.test(form.cnic_number.trim())) {
    return 'Enter a valid CNIC number (e.g. 12345-1234567-1).';
  }
  return null;
}

function validateEducation(form: ProfileForm): string | null {
  if (form.educations.length === 0) return 'Add at least one education entry.';
  for (let index = 0; index < form.educations.length; index += 1) {
    const entry = form.educations[index];
    const label = form.educations.length > 1 ? ` (entry ${index + 1})` : '';
    if (!entry.education_level.trim()) return `Education level is required${label}.`;
    if (!entry.institution_name.trim()) return `Institution name is required${label}.`;
    if (!entry.field_of_study.trim()) return `Field of study is required${label}.`;
    if (!entry.graduation_year.trim()) return `Graduation year is required${label}.`;
  }
  return null;
}

function validateJob(form: ProfileForm): string | null {
  if (!form.job_title.trim()) return 'Job title is required.';
  if (!form.employer_name.trim()) return 'Employer name is required.';
  if (!form.years_of_experience.trim()) return 'Years of experience is required.';
  return null;
}

function validateOther(form: ProfileForm): string | null {
  if (!form.other_information.trim()) return 'Please describe your other information.';
  return null;
}

function validateSection(form: ProfileForm, section: ProfileSection): string | null {
  if (section === 'personal') return validatePersonal(form);
  if (section === 'education') return validateEducation(form);
  if (section === 'job') return validateJob(form);
  return validateOther(form);
}

function validateForm(form: ProfileForm): string | null {
  return (
    validatePersonal(form) ||
    validateEducation(form) ||
    validateJob(form) ||
    validateOther(form)
  );
}

function toPayload(form: ProfileForm) {
  const category = (form.information_category || 'other') as InformationCategory;
  const educations = form.educations.map((entry) => ({
    education_level: entry.education_level.trim(),
    institution_name: entry.institution_name.trim(),
    field_of_study: entry.field_of_study.trim(),
    graduation_year: entry.graduation_year.trim(),
  }));
  const primary = educations[0];

  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    date_of_birth: form.date_of_birth,
    gender: form.gender,
    nationality: form.nationality.trim(),
    country_of_residence: form.country_of_residence.trim(),
    city: form.city.trim(),
    address: form.address.trim(),
    passport_number: form.passport_number.trim(),
    cnic_number: form.cnic_number.trim(),
    information_category: category,
    educations,
    education_level: primary?.education_level ?? '',
    institution_name: primary?.institution_name ?? '',
    field_of_study: primary?.field_of_study ?? '',
    graduation_year: primary?.graduation_year ?? '',
    job_title: form.job_title.trim(),
    employer_name: form.employer_name.trim(),
    years_of_experience: form.years_of_experience.trim(),
    other_information: form.other_information.trim(),
  };
}

export function StudentProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activePortal = useAuthStore((state) => state.activePortal);
  const setSession = useAuthStore((state) => state.setSession);

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [error, setError] = useState<string | null>(null);
  const [educationFiles, setEducationFiles] = useState<Record<string, File | null>>({});
  const [documentError, setDocumentError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(toForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  const cityOptions = useMemo(() => {
    const cities = citiesForCountry(form.country_of_residence);
    if (form.city && !cities.includes(form.city)) {
      return [form.city, ...cities];
    }
    return cities;
  }, [form.country_of_residence, form.city]);

  const nationalityOptions = useMemo(() => {
    const names = COUNTRIES.map((country) => country.name);
    if (form.nationality && !names.includes(form.nationality)) {
      return [form.nationality, ...names];
    }
    return names;
  }, [form.nationality]);

  const citySelectOptions = useMemo(
    () => cityOptions.map((city) => ({ value: city, label: city })),
    [cityOptions],
  );

  const nationalitySelectOptions = useMemo(
    () =>
      nationalityOptions.map((name) => {
        const flag = COUNTRIES.find((country) => country.name === name)?.flag ?? '';
        return {
          value: name,
          label: flag ? `${flag} ${name}` : name,
        };
      }),
    [nationalityOptions],
  );

  const educationLevelOptions = useMemo(() => {
    const base = EDUCATION_LEVELS.map((level) => ({ value: level, label: level }));
    const extras = form.educations
      .map((entry) => entry.education_level)
      .filter(
        (level) =>
          level && !EDUCATION_LEVELS.includes(level as EducationLevel),
      );
    const uniqueExtras = [...new Set(extras)];
    return [
      ...base,
      ...uniqueExtras.map((level) => ({ value: level, label: level })),
    ];
  }, [form.educations]);

  const countrySelectOptions = useMemo(() => {
    const base = COUNTRIES.map((country) => ({
      value: country.name,
      label: `${country.flag} ${country.name}`,
    }));
    if (
      form.country_of_residence &&
      !COUNTRIES.some((country) => country.name === form.country_of_residence)
    ) {
      return [{ value: form.country_of_residence, label: form.country_of_residence }, ...base];
    }
    return base;
  }, [form.country_of_residence]);

  const saveProfile = useMutation({
    mutationFn: async (payload: ProfileForm) => {
      const docs = queryClient.getQueryData<StudentDocument[]>(['student-documents']) ?? [];
      const uploads: Promise<void>[] = [];

      for (const entry of payload.educations) {
        const file = educationFiles[entry.key];
        const educationMeta = documentTypeForEducationLevel(entry.education_level);
        if (file && educationMeta) {
          uploads.push(
            uploadStudentDocument({
              type: educationMeta.type,
              title: educationMeta.title,
              file,
              existing: docs.find((doc) => doc.type === educationMeta.type) ?? null,
            }),
          );
        }
      }

      await Promise.all(uploads);

      const { data } = await api.put<{ data: StudentProfile; message?: string }>(
        '/student/profile',
        toPayload(payload),
      );
      return data.data;
    },
    onSuccess: async (profile) => {
      setError(null);
      setDocumentError(null);
      setEducationFiles({});
      setForm(toForm(profile));
      await queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
      if (token && user && activePortal) {
        setSession(activePortal, token, { ...user, name: profile.name });
      }
      navigate(StudentRoutes.home, { replace: true });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setDocumentError(err.message);
        return;
      }
      setError(getApiErrorMessage(err, 'Could not save profile.'));
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (payload: { type: DocumentType; title: string; file: File }) => {
      const docs = queryClient.getQueryData<StudentDocument[]>(['student-documents']) ?? [];
      await uploadStudentDocument({
        ...payload,
        existing: docs.find((doc) => doc.type === payload.type) ?? null,
      });
    },
    onSuccess: async () => {
      setDocumentError(null);
      setEducationFiles({});
      await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setDocumentError(err.message);
        return;
      }
      setDocumentError(getApiErrorMessage(err, 'Could not upload document.'));
    },
  });

  const { complete, progressPct } = sectionProgress(form, activeSection);
  const sectionName = sectionLabel(activeSection);

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSectionChange(section: ProfileSection) {
    setActiveSection(section);
    setError(null);
    if (section !== 'personal') {
      updateField('information_category', section);
    }
  }

  function onCountryChange(country: string) {
    const nextCities = citiesForCountry(country);
    setForm((current) => ({
      ...current,
      country_of_residence: country,
      city: nextCities.includes(current.city) ? current.city : '',
    }));
  }

  function updateEducation(
    key: string,
    patch: Partial<Omit<EducationEntry, 'key'>>,
  ) {
    setForm((current) => ({
      ...current,
      educations: current.educations.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function addEducation() {
    setForm((current) => ({
      ...current,
      educations: [...current.educations, emptyEducation()],
    }));
    setError(null);
  }

  function removeEducation(key: string) {
    setForm((current) => ({
      ...current,
      educations:
        current.educations.length <= 1
          ? current.educations
          : current.educations.filter((entry) => entry.key !== key),
    }));
    setEducationFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const sectionError = validateSection(form, activeSection);
    if (sectionError) {
      setError(sectionError);
      return;
    }

    const upcoming = nextSection(activeSection);
    if (upcoming) {
      onSectionChange(upcoming);
      return;
    }

    // Final section (Other): save everything and return to the dashboard.
    const fullError = validateForm(form);
    if (fullError) {
      setError(fullError);
      if (validatePersonal(form)) setActiveSection('personal');
      else if (validateEducation(form)) setActiveSection('education');
      else if (validateJob(form)) setActiveSection('job');
      else setActiveSection('other');
      return;
    }

    saveProfile.mutate({
      ...form,
      information_category: form.information_category || 'other',
    });
  }

  const backSection = previousSection(activeSection);

  return (
    <AppShell badge="Student" title={sectionPageTitle(activeSection)}>
      <div className="page-stack">
        {backSection ? (
          <PageBackButton
            label={`Back to ${sectionPageTitle(backSection).toLowerCase()}`}
            onClick={() => onSectionChange(backSection)}
          />
        ) : null}
        <SectionProgress
          loading={profileQuery.isLoading}
          title={
            complete
              ? `${sectionName.charAt(0).toUpperCase()}${sectionName.slice(1)} complete`
              : `${sectionName.charAt(0).toUpperCase()}${sectionName.slice(1)} incomplete`
          }
          percent={progressPct}
        />

        <section className="panel">
              <div className="profile-card-head">
                <h2>Edit your details</h2>
                <div className="profile-card-select">
                  <SearchableSelect
                    value={activeSection}
                    options={SECTION_OPTIONS}
                    searchable={false}
                    ariaLabel="Information type"
                    onChange={(value) => onSectionChange(value as ProfileSection)}
                  />
                </div>
              </div>
              <p className="muted">
                {activeSection === 'personal'
                  ? 'All fields marked with '
                  : 'Fill in this section. All fields marked with '}
                <span className="req">*</span>
                {activeSection === 'personal'
                  ? ' are required. Email stays with your account and cannot be changed here.'
                  : ' are required. Switch sections from the dropdown above.'}
              </p>

              {profileQuery.isLoading ? <p className="muted">Loading…</p> : null}

              <form className="org-form profile-form" onSubmit={onSubmit} noValidate>
                {activeSection === 'personal' ? (
                  <>
                <label className="field">
                  <span>
                    Full name <span className="req">*</span>
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    required
                    autoComplete="name"
                  />
                </label>

                <label className="field">
                  <span>Email</span>
                  <input value={profileQuery.data?.email ?? ''} disabled readOnly />
                </label>

                <label className="field">
                  <span>
                    Phone <span className="req">*</span>
                  </span>
                  <input
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    autoComplete="tel"
                    placeholder="+92 300 0000000"
                    required
                  />
                </label>

                <label className="field">
                  <span>
                    Date of birth <span className="req">*</span>
                  </span>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) => updateField('date_of_birth', event.target.value)}
                    required
                    max={(() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      return yesterday.toISOString().slice(0, 10);
                    })()}
                  />
                </label>

                <label className="field">
                  <span>
                    Gender <span className="req">*</span>
                  </span>
                  <SearchableSelect
                    value={form.gender}
                    options={GENDER_OPTIONS}
                    placeholder="Select"
                    searchable={false}
                    onChange={(value) => updateField('gender', value)}
                  />
                </label>

                <label className="field">
                  <span>
                    Nationality <span className="req">*</span>
                  </span>
                  <SearchableSelect
                    value={form.nationality}
                    options={nationalitySelectOptions}
                    placeholder="Select nationality"
                    searchPlaceholder="Search nationality"
                    onChange={(value) => updateField('nationality', value)}
                  />
                </label>

                <label className="field">
                  <span>
                    Country of residence <span className="req">*</span>
                  </span>
                  <SearchableSelect
                    value={form.country_of_residence}
                    options={countrySelectOptions}
                    placeholder="Select country"
                    searchPlaceholder="Search country"
                    onChange={onCountryChange}
                  />
                </label>

                <label className="field">
                  <span>
                    City <span className="req">*</span>
                  </span>
                  <SearchableSelect
                    value={form.city}
                    options={citySelectOptions}
                    placeholder={
                      form.country_of_residence ? 'Select city' : 'Select a country first'
                    }
                    searchPlaceholder="Search city"
                    disabled={!form.country_of_residence}
                    emptyMessage={
                      form.country_of_residence
                        ? 'No cities match your search'
                        : 'Select a country first'
                    }
                    onChange={(value) => updateField('city', value)}
                  />
                </label>

                <label className="field">
                  <span>
                    Address <span className="req">*</span>
                  </span>
                  <input
                    value={form.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    placeholder="Street, area"
                    required
                  />
                </label>

                <label className="field">
                  <span>
                    Passport number <span className="req">*</span>
                  </span>
                  <input
                    value={form.passport_number}
                    onChange={(event) => updateField('passport_number', event.target.value)}
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="field">
                  <span>
                    CNIC number <span className="req">*</span>
                  </span>
                  <input
                    value={form.cnic_number}
                    onChange={(event) => updateField('cnic_number', event.target.value)}
                    autoComplete="off"
                    placeholder="12345-1234567-1"
                    required
                  />
                </label>
                  </>
                ) : null}

                {activeSection === 'education' ? (
                  <>
                    <div className="profile-education-list">
                      {form.educations.map((entry, index) => {
                        const educationDocMeta = documentTypeForEducationLevel(
                          entry.education_level,
                        );
                        const existingEducationDoc = educationDocMeta
                          ? (documentsQuery.data?.find(
                              (doc) => doc.type === educationDocMeta.type,
                            ) ?? null)
                          : null;
                        const educationFile = educationFiles[entry.key] ?? null;

                        return (
                          <div key={entry.key} className="profile-education-card">
                            <div className="profile-education-card-head">
                              <h3>
                                Education {form.educations.length > 1 ? index + 1 : ''}
                              </h3>
                              {form.educations.length > 1 ? (
                                <button
                                  type="button"
                                  className="ghost-btn danger"
                                  onClick={() => removeEducation(entry.key)}>
                                  Remove
                                </button>
                              ) : null}
                            </div>

                            <label className="field">
                              <span>
                                Education level <span className="req">*</span>
                              </span>
                              <SearchableSelect
                                value={entry.education_level}
                                options={educationLevelOptions}
                                placeholder="Select"
                                searchable={false}
                                onChange={(value) =>
                                  updateEducation(entry.key, { education_level: value })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>
                                Institution name <span className="req">*</span>
                              </span>
                              <input
                                value={entry.institution_name}
                                onChange={(event) =>
                                  updateEducation(entry.key, {
                                    institution_name: event.target.value,
                                  })
                                }
                                placeholder="School or university"
                                required
                              />
                            </label>
                            <label className="field">
                              <span>
                                Field of study <span className="req">*</span>
                              </span>
                              <input
                                value={entry.field_of_study}
                                onChange={(event) =>
                                  updateEducation(entry.key, {
                                    field_of_study: event.target.value,
                                  })
                                }
                                placeholder="e.g. Computer Science"
                                required
                              />
                            </label>
                            <label className="field">
                              <span>
                                Graduation year <span className="req">*</span>
                              </span>
                              <input
                                value={entry.graduation_year}
                                onChange={(event) =>
                                  updateEducation(entry.key, {
                                    graduation_year: event.target.value,
                                  })
                                }
                                placeholder="e.g. 2024"
                                required
                              />
                            </label>

                            <div className="field education-doc-upload">
                              <span>
                                Upload {educationDocMeta?.title ?? 'education document'}
                              </span>
                              <p className="muted" style={{ margin: 0 }}>
                                Saved uploads appear on your Documents page as pending for
                                approval.
                              </p>
                              {existingEducationDoc ? (
                                <p className="muted" style={{ margin: 0 }}>
                                  On file: {existingEducationDoc.original_name} (
                                  {existingEducationDoc.status_label})
                                </p>
                              ) : null}
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                disabled={
                                  !educationDocMeta ||
                                  uploadDocument.isPending ||
                                  saveProfile.isPending
                                }
                                onChange={(event) => {
                                  setDocumentError(null);
                                  const file = event.target.files?.[0] ?? null;
                                  setEducationFiles((current) => ({
                                    ...current,
                                    [entry.key]: file,
                                  }));
                                }}
                              />
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={
                                  !educationDocMeta ||
                                  !educationFile ||
                                  uploadDocument.isPending ||
                                  saveProfile.isPending
                                }
                                onClick={() => {
                                  if (!educationDocMeta || !educationFile) return;
                                  uploadDocument.mutate({
                                    type: educationDocMeta.type,
                                    title: educationDocMeta.title,
                                    file: educationFile,
                                  });
                                }}>
                                {uploadDocument.isPending
                                  ? 'Uploading…'
                                  : existingEducationDoc &&
                                      (existingEducationDoc.status === 'pending' ||
                                        existingEducationDoc.status === 'rejected')
                                    ? 'Replace document'
                                    : 'Upload document'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="ghost-btn profile-education-add"
                      onClick={addEducation}>
                      + Add another education
                    </button>

                    {documentError ? <p className="form-error">{documentError}</p> : null}
                  </>
                ) : null}

                {activeSection === 'job' ? (
                  <>
                    <label className="field">
                      <span>
                        Job title <span className="req">*</span>
                      </span>
                      <input
                        value={form.job_title}
                        onChange={(event) => updateField('job_title', event.target.value)}
                        placeholder="e.g. Software engineer"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>
                        Employer name <span className="req">*</span>
                      </span>
                      <input
                        value={form.employer_name}
                        onChange={(event) => updateField('employer_name', event.target.value)}
                        placeholder="Company name"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>
                        Years of experience <span className="req">*</span>
                      </span>
                      <input
                        value={form.years_of_experience}
                        onChange={(event) => updateField('years_of_experience', event.target.value)}
                        placeholder="e.g. 3"
                        required
                      />
                    </label>
                  </>
                ) : null}

                {activeSection === 'other' ? (
                  <label className="field">
                    <span>
                      Other information <span className="req">*</span>
                    </span>
                    <textarea
                      value={form.other_information}
                      onChange={(event) => updateField('other_information', event.target.value)}
                      placeholder="Share any other relevant details"
                      rows={4}
                      required
                    />
                  </label>
                ) : null}

                {error ? <p className="form-error">{error}</p> : null}

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={
                    saveProfile.isPending || uploadDocument.isPending || profileQuery.isLoading
                  }>
                  {saveProfile.isPending
                    ? Object.values(educationFiles).some(Boolean)
                      ? 'Saving and uploading…'
                      : 'Saving…'
                    : activeSection === 'other'
                      ? 'Save and go to dashboard'
                      : 'Continue'}
                </button>
              </form>
            </section>
      </div>
    </AppShell>
  );
}
