import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SelectField, SelectSheet } from '@/components/student/select-sheet';
import { SectionProgress } from '@/components/student/section-progress';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { citiesForCountry } from '@/constants/cities';
import { COUNTRIES, DEFAULT_DIAL, findCountryByDial, joinPhone, splitPhone } from '@/constants/countries';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  type PickedUploadFile,
  uploadStudentDocument,
} from '@/lib/upload-student-document';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, Gender, InformationCategory, StudentDocument, StudentProfile } from '@/types/auth';

type ProfileSection = 'personal' | InformationCategory;

type EducationEntry = {
  key: string;
  education_level: string;
  institution_name: string;
  field_of_study: string;
  graduation_year: string;
};

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const INFORMATION_OPTIONS: { value: 'personal' | InformationCategory; label: string }[] = [
  { value: 'personal', label: 'Personal information' },
  { value: 'education', label: 'Education information' },
  { value: 'job', label: 'Job information' },
  { value: 'other', label: 'Other' },
];

const EDUCATION_LEVELS = ['Matric', 'Intermediate', "Bachelor's", 'Diploma'] as const;
const EDUCATION_LEVEL_OPTIONS = EDUCATION_LEVELS.map((level) => ({
  label: level,
  value: level,
}));

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

const MIN_BIRTH_DATE = new Date(1950, 0, 1);

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

type ProfileForm = {
  name: string;
  phone: string;
  date_of_birth: string;
  gender: Gender | null;
  nationality: string;
  country_of_residence: string;
  city: string;
  address: string;
  passport_number: string;
  cnic_number: string;
  information_category: InformationCategory | null;
  educations: EducationEntry[];
  job_title: string;
  employer_name: string;
  years_of_experience: string;
  other_information: string;
};

const emptyForm: ProfileForm = {
  name: '',
  phone: '',
  date_of_birth: '',
  gender: null,
  nationality: '',
  country_of_residence: '',
  city: '',
  address: '',
  passport_number: '',
  cnic_number: '',
  information_category: null,
  educations: [emptyEducation()],
  job_title: '',
  employer_name: '',
  years_of_experience: '',
  other_information: '',
};

const CNIC_PATTERN = /^[0-9]{5}-?[0-9]{7}-?[0-9]$/;

function yesterday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  return date;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() - 18);
    return fallback;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  if (!value) {
    return '';
  }

  return parseDate(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function toForm(profile: StudentProfile): ProfileForm {
  const phone = splitPhone(profile.phone);
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
    phone: phone.number,
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender,
    nationality: profile.nationality ?? '',
    country_of_residence: profile.country_of_residence ?? '',
    city: profile.city ?? '',
    address: profile.address ?? '',
    passport_number: profile.passport_number ?? '',
    cnic_number: profile.cnic_number ?? '',
    information_category: profile.information_category,
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
    form.gender ?? '',
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
    date_of_birth: form.date_of_birth.trim(),
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

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  label: country.name,
  value: country.name,
  prefix: country.flag,
}));

const DIAL_OPTIONS = COUNTRIES.map((country) => ({
  label: `${country.name} ${country.dial}`,
  value: country.iso,
  prefix: country.flag,
}));

const GENDER_SELECT_OPTIONS = GENDER_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}));

const INFORMATION_SELECT_OPTIONS = INFORMATION_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}));

export default function StudentPersonalInformationScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const patchUser = useAuthStore((state) => state.patchUser);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dialIso, setDialIso] = useState('PK');
  const [activeSection, setActiveSection] = useState<'personal' | InformationCategory>('personal');
  const [passportPicked, setPassportPicked] = useState<PickedUploadFile | null>(null);
  const [cnicPicked, setCnicPicked] = useState<PickedUploadFile | null>(null);
  const [educationPicked, setEducationPicked] = useState<Record<string, PickedUploadFile | null>>(
    {},
  );
  const [educationLevelEntryKey, setEducationLevelEntryKey] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<
    'gender' | 'country' | 'dial' | 'city' | 'nationality' | 'information' | 'education_level' | null
  >(null);

  const isStudent = user?.roles.includes('student') ?? false;
  const maxBirthDate = useMemo(() => yesterday(), []);
  const cityOptions = useMemo(() => {
    const cities = citiesForCountry(form.country_of_residence);
    const list =
      form.city && !cities.includes(form.city) ? [form.city, ...cities] : cities;
    return list.map((city) => ({ label: city, value: city }));
  }, [form.country_of_residence, form.city]);
  const nationalityOptions = useMemo(() => {
    const names = COUNTRIES.map((country) => country.name);
    const list =
      form.nationality && !names.includes(form.nationality)
        ? [form.nationality, ...names]
        : names;
    return list.map((name) => {
      const flag = COUNTRIES.find((country) => country.name === name)?.flag ?? '';
      return {
        label: flag ? `${flag} ${name}` : name,
        value: name,
      };
    });
  }, [form.nationality]);
  const educationLevelOptions = useMemo(() => {
    const extras = form.educations
      .map((entry) => entry.education_level)
      .filter(
        (level) => level && !EDUCATION_LEVELS.includes(level as EducationLevel),
      );
    const uniqueExtras = [...new Set(extras)];
    return [
      ...EDUCATION_LEVEL_OPTIONS,
      ...uniqueExtras.map((level) => ({ label: level, value: level })),
    ];
  }, [form.educations]);
  const selectedDial = COUNTRIES.find((country) => country.iso === dialIso)?.dial ?? DEFAULT_DIAL;
  const selectedDialCountry = findCountryByDial(selectedDial);

  const profileQuery = useQuery({
    queryKey: ['student-profile'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const existingPassportDoc = useMemo(
    () => documentsQuery.data?.find((doc) => doc.type === 'passport') ?? null,
    [documentsQuery.data],
  );

  const existingCnicDoc = useMemo(
    () => documentsQuery.data?.find((doc) => doc.type === 'cnic') ?? null,
    [documentsQuery.data],
  );

  useEffect(() => {
    if (profileQuery.data) {
      const phone = splitPhone(profileQuery.data.phone);
      setForm(toForm(profileQuery.data));
      setDialIso(findCountryByDial(phone.dial)?.iso ?? 'PK');
    }
  }, [profileQuery.data]);

  const saveProfile = useMutation({
    mutationFn: async (payload: ProfileForm) => {
      const docs = queryClient.getQueryData<StudentDocument[]>(['student-documents']) ?? [];
      const uploads: Promise<void>[] = [];

      if (passportPicked) {
        uploads.push(
          uploadStudentDocument({
            type: 'passport',
            title: 'Passport bio page',
            file: passportPicked,
            existing: docs.find((doc) => doc.type === 'passport') ?? null,
          }),
        );
      }

      if (cnicPicked) {
        uploads.push(
          uploadStudentDocument({
            type: 'cnic',
            title: 'CNIC',
            file: cnicPicked,
            existing: docs.find((doc) => doc.type === 'cnic') ?? null,
          }),
        );
      }

      for (const entry of payload.educations) {
        const file = educationPicked[entry.key];
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

      const { data } = await api.put<{ data: StudentProfile; message: string }>(
        '/student/profile',
        toPayload(payload),
      );
      return data;
    },
    onSuccess: (data) => {
      Keyboard.dismiss();
      setError(null);
      setDocumentError(null);
      setPassportPicked(null);
      setCnicPicked(null);
      setEducationPicked({});
      queryClient.setQueryData(['student-profile'], data.data);
      void queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      void queryClient.invalidateQueries({ queryKey: ['student-application-status'] });

      if (data.data.name) {
        patchUser({ name: data.data.name });
      }

      router.replace('/home');
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setDocumentError(err.message);
        return;
      }
      setError(getApiErrorMessage(err, 'Could not save personal information.'));
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (payload: { type: DocumentType; title: string; file: PickedUploadFile }) => {
      const docs = queryClient.getQueryData<StudentDocument[]>(['student-documents']) ?? [];
      await uploadStudentDocument({
        ...payload,
        existing: docs.find((doc) => doc.type === payload.type) ?? null,
      });
    },
    onSuccess: async (_, variables) => {
      setDocumentError(null);
      if (variables.type === 'passport') {
        setPassportPicked(null);
      } else if (variables.type === 'cnic') {
        setCnicPicked(null);
      } else {
        setEducationPicked({});
      }
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

  if (!token || !user) {
    return <Redirect href="/welcome" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

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

  function updateEducation(key: string, patch: Partial<Omit<EducationEntry, 'key'>>) {
    setForm((current) => ({
      ...current,
      educations: current.educations.map((entry) =>
        entry.key === key ? { ...entry, ...patch } : entry,
      ),
    }));
    if (patch.education_level !== undefined) {
      setEducationPicked((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setDocumentError(null);
    }
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
    setEducationPicked((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  const { complete, progressPct } = sectionProgress(form, activeSection);
  const sectionName = sectionLabel(activeSection);
  const backSection = previousSection(activeSection);
  const educationLevelEntry = form.educations.find(
    (entry) => entry.key === educationLevelEntryKey,
  );
  const hasEducationFiles = Object.values(educationPicked).some(Boolean);

  async function pickDocumentFile(onPick: (file: PickedUploadFile) => void) {
    setDocumentError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    onPick({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
    });
  }

  async function pickEducationDocument(entryKey: string) {
    await pickDocumentFile((file) => {
      setEducationPicked((current) => ({ ...current, [entryKey]: file }));
    });
  }

  async function pickPassportDocument() {
    await pickDocumentFile(setPassportPicked);
  }

  async function pickCnicDocument() {
    await pickDocumentFile(setCnicPicked);
  }

  function onSave() {
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

    const saveForm: ProfileForm = {
      ...form,
      information_category: form.information_category || 'other',
    };
    const fullError = validateForm(saveForm);
    if (fullError) {
      setError(fullError);
      if (validatePersonal(saveForm)) setActiveSection('personal');
      else if (validateEducation(saveForm)) setActiveSection('education');
      else if (validateJob(saveForm)) setActiveSection('job');
      else setActiveSection('other');
      return;
    }

    saveProfile.mutate({
      ...saveForm,
      phone: joinPhone(selectedDial, form.phone),
    });
  }

  function onPickDate(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setCalendarOpen(false);
      if (event.type !== 'set' || !date) {
        return;
      }
    }

    if (date) {
      updateField('date_of_birth', toIsoDate(date));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <StudentScreen
        showBack
        onBackPress={() => {
          if (backSection) {
            setActiveSection(backSection);
            return;
          }
          router.back();
        }}
        title={sectionPageTitle(activeSection)}>
        {profileQuery.isLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            {backSection ? (
              <Pressable
                onPress={() => setActiveSection(backSection)}
                style={styles.sectionBack}>
                <ThemedText type="smallBold">
                  ← Back to {sectionPageTitle(backSection).toLowerCase()}
                </ThemedText>
              </Pressable>
            ) : null}
            <SectionProgress
              loading={false}
              title={
                complete
                  ? `${sectionName.charAt(0).toUpperCase()}${sectionName.slice(1)} complete`
                  : `${sectionName.charAt(0).toUpperCase()}${sectionName.slice(1)} incomplete`
              }
              percent={progressPct}
            />

            <StudentSurface style={styles.formCard}>
              <View style={[styles.formHead, { borderBottomColor: theme.border }]}>
                <View style={styles.formHeadRow}>
                  <ThemedText type="smallBold" style={styles.formHeadTitle}>
                    Edit your details
                  </ThemedText>
                  <Pressable
                    accessibilityLabel="Information type"
                    accessibilityRole="button"
                    onPress={() => {
                      Keyboard.dismiss();
                      setOpenSheet('information');
                    }}
                    style={[
                      styles.sectionSelect,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.border,
                      },
                    ]}>
                    <ThemedText numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 13 }}>
                      {INFORMATION_OPTIONS.find((option) => option.value === activeSection)
                        ?.label ?? 'Select section'}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>
                      ▾
                    </ThemedText>
                  </Pressable>
                </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHint}>
                Fields marked with * are required. Fill Personal, Education, Job, and Other.
              </ThemedText>
              </View>

            {activeSection === 'personal' ? (
              <>
            <Field
              label="Full name"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Your full name"
              required
              theme={theme}
              value={form.name}
            />
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                Email
              </ThemedText>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText style={{ color: theme.text }}>{user.email}</ThemedText>
              </View>
            </View>
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                Phone
                <ThemedText style={styles.req}> *</ThemedText>
              </ThemedText>
              <View style={styles.phoneRow}>
                <Pressable
                  accessibilityLabel="Country code"
                  accessibilityRole="button"
                  onPress={() => {
                    Keyboard.dismiss();
                    setOpenSheet('dial');
                  }}
                  style={[
                    styles.dialBtn,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                    },
                  ]}>
                  <ThemedText>
                    {selectedDialCountry?.flag} {selectedDial}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary">▾</ThemedText>
                </Pressable>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateField('phone', value.replace(/[^\d]/g, ''))}
                  placeholder="3001234567"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    styles.phoneInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={form.phone}
                />
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                Date of birth
                <ThemedText style={styles.req}> *</ThemedText>
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  Keyboard.dismiss();
                  setCalendarOpen(true);
                }}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText
                  style={{ color: form.date_of_birth ? theme.text : theme.textSecondary }}>
                  {form.date_of_birth
                    ? formatDisplayDate(form.date_of_birth)
                    : 'Select date of birth'}
                </ThemedText>
              </Pressable>
            </View>

            <SelectField
              label="Gender"
              placeholder="Select gender"
              required
              variant="form"
              valueLabel={GENDER_OPTIONS.find((option) => option.value === form.gender)?.label}
              onPress={() => setOpenSheet('gender')}
            />

            <SelectField
              label="Nationality"
              placeholder="Select nationality"
              required
              variant="form"
              valueLabel={form.nationality || null}
              onPress={() => setOpenSheet('nationality')}
            />
            <SelectField
              label="Country of residence"
              placeholder="Select country"
              required
              variant="form"
              valueLabel={form.country_of_residence || null}
              onPress={() => setOpenSheet('country')}
            />
            <SelectField
              label="City"
              placeholder={
                form.country_of_residence ? 'Select city' : 'Select a country first'
              }
              required
              variant="form"
              valueLabel={form.city || null}
              onPress={() => {
                if (!form.country_of_residence) {
                  setOpenSheet('country');
                  return;
                }
                setOpenSheet('city');
              }}
            />
            <Field
              label="Address"
              multiline
              onChangeText={(value) => updateField('address', value)}
              placeholder="Street address"
              required
              theme={theme}
              value={form.address}
            />
            <Field
              autoCapitalize="characters"
              label="Passport number"
              onChangeText={(value) => updateField('passport_number', value)}
              placeholder="Passport number"
              required
              theme={theme}
              value={form.passport_number}
            />
            <Field
              label="CNIC number"
              onChangeText={(value) => updateField('cnic_number', value)}
              placeholder="12345-1234567-1"
              required
              theme={theme}
              value={form.cnic_number}
            />

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                Upload passport bio page
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Saved uploads appear on your Documents page as pending for approval.
              </ThemedText>
              {existingPassportDoc ? (
                <ThemedText type="small" themeColor="textSecondary">
                  On file: {existingPassportDoc.original_name} ({existingPassportDoc.status_label})
                </ThemedText>
              ) : null}
              <Pressable
                disabled={uploadDocument.isPending || saveProfile.isPending}
                onPress={() => void pickPassportDocument()}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText
                  style={{
                    color: passportPicked ? theme.text : theme.textSecondary,
                  }}>
                  {passportPicked?.name ?? 'Choose passport file'}
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={!passportPicked || uploadDocument.isPending || saveProfile.isPending}
                onPress={() =>
                  passportPicked
                    ? uploadDocument.mutate({
                        type: 'passport',
                        title: 'Passport bio page',
                        file: passportPicked,
                      })
                    : undefined
                }
                style={[
                  styles.docUploadBtn,
                  {
                    opacity:
                      !passportPicked || uploadDocument.isPending || saveProfile.isPending
                        ? 0.55
                        : 1,
                  },
                ]}>
                <ThemedText type="smallBold">
                  {uploadDocument.isPending
                    ? 'Uploading…'
                    : existingPassportDoc &&
                        (existingPassportDoc.status === 'pending' ||
                          existingPassportDoc.status === 'rejected')
                      ? 'Replace passport'
                      : 'Upload passport'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                Upload CNIC
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Saved uploads appear on your Documents page as pending for approval.
              </ThemedText>
              {existingCnicDoc ? (
                <ThemedText type="small" themeColor="textSecondary">
                  On file: {existingCnicDoc.original_name} ({existingCnicDoc.status_label})
                </ThemedText>
              ) : null}
              <Pressable
                disabled={uploadDocument.isPending || saveProfile.isPending}
                onPress={() => void pickCnicDocument()}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}>
                <ThemedText
                  style={{
                    color: cnicPicked ? theme.text : theme.textSecondary,
                  }}>
                  {cnicPicked?.name ?? 'Choose CNIC file'}
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={!cnicPicked || uploadDocument.isPending || saveProfile.isPending}
                onPress={() =>
                  cnicPicked
                    ? uploadDocument.mutate({
                        type: 'cnic',
                        title: 'CNIC',
                        file: cnicPicked,
                      })
                    : undefined
                }
                style={[
                  styles.docUploadBtn,
                  {
                    opacity:
                      !cnicPicked || uploadDocument.isPending || saveProfile.isPending ? 0.55 : 1,
                  },
                ]}>
                <ThemedText type="smallBold">
                  {uploadDocument.isPending
                    ? 'Uploading…'
                    : existingCnicDoc &&
                        (existingCnicDoc.status === 'pending' ||
                          existingCnicDoc.status === 'rejected')
                      ? 'Replace CNIC'
                      : 'Upload CNIC'}
                </ThemedText>
              </Pressable>
            </View>

            {documentError ? (
              <ThemedText type="small" style={styles.error}>
                {documentError}
              </ThemedText>
            ) : null}
              </>
            ) : null}

            {activeSection === 'education' ? (
              <>
                {form.educations.map((entry, index) => {
                  const educationDocMeta = documentTypeForEducationLevel(entry.education_level);
                  const existingEducationDoc = educationDocMeta
                    ? (documentsQuery.data?.find(
                        (doc) => doc.type === educationDocMeta.type,
                      ) ?? null)
                    : null;
                  const pickedFile = educationPicked[entry.key] ?? null;

                  return (
                    <View
                      key={entry.key}
                      style={[
                        styles.educationCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.backgroundElement,
                        },
                      ]}>
                      <View style={styles.educationCardHead}>
                        <ThemedText type="smallBold">
                          Education{form.educations.length > 1 ? ` ${index + 1}` : ''}
                        </ThemedText>
                        {form.educations.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => removeEducation(entry.key)}>
                            <ThemedText type="small" style={styles.removeEducation}>
                              Remove
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>

                      <SelectField
                        label="Education level"
                        placeholder="Select education level"
                        required
                        variant="form"
                        valueLabel={entry.education_level || null}
                        onPress={() => {
                          setEducationLevelEntryKey(entry.key);
                          setOpenSheet('education_level');
                        }}
                      />
                      <Field
                        label="Institution name"
                        onChangeText={(value) =>
                          updateEducation(entry.key, { institution_name: value })
                        }
                        placeholder="School or university"
                        required
                        theme={theme}
                        value={entry.institution_name}
                      />
                      <Field
                        label="Field of study"
                        onChangeText={(value) =>
                          updateEducation(entry.key, { field_of_study: value })
                        }
                        placeholder="e.g. Computer Science"
                        required
                        theme={theme}
                        value={entry.field_of_study}
                      />
                      <Field
                        label="Graduation year"
                        onChangeText={(value) =>
                          updateEducation(entry.key, { graduation_year: value })
                        }
                        placeholder="e.g. 2024"
                        required
                        theme={theme}
                        value={entry.graduation_year}
                      />

                      <View style={styles.field}>
                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                          style={styles.fieldLabel}>
                          Upload {educationDocMeta?.title ?? 'education document'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Saved uploads appear on your Documents page as pending for approval.
                        </ThemedText>
                        {existingEducationDoc ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            On file: {existingEducationDoc.original_name} (
                            {existingEducationDoc.status_label})
                          </ThemedText>
                        ) : null}
                        <Pressable
                          disabled={
                            !educationDocMeta ||
                            uploadDocument.isPending ||
                            saveProfile.isPending
                          }
                          onPress={() => void pickEducationDocument(entry.key)}
                          style={[
                            styles.input,
                            {
                              backgroundColor: theme.background,
                              borderColor: theme.border,
                            },
                          ]}>
                          <ThemedText
                            style={{
                              color: pickedFile ? theme.text : theme.textSecondary,
                            }}>
                            {pickedFile?.name ?? 'Choose document file'}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={
                            !educationDocMeta ||
                            !pickedFile ||
                            uploadDocument.isPending ||
                            saveProfile.isPending
                          }
                          onPress={() => {
                            if (!educationDocMeta || !pickedFile) return;
                            uploadDocument.mutate({
                              type: educationDocMeta.type,
                              title: educationDocMeta.title,
                              file: pickedFile,
                            });
                          }}
                          style={[
                            styles.docUploadBtn,
                            {
                              opacity:
                                !educationDocMeta ||
                                !pickedFile ||
                                uploadDocument.isPending ||
                                saveProfile.isPending
                                  ? 0.55
                                  : 1,
                            },
                          ]}>
                          <ThemedText type="smallBold">
                            {uploadDocument.isPending
                              ? 'Uploading…'
                              : existingEducationDoc &&
                                  (existingEducationDoc.status === 'pending' ||
                                    existingEducationDoc.status === 'rejected')
                                ? 'Replace document'
                                : 'Upload document'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  accessibilityRole="button"
                  onPress={addEducation}
                  style={[
                    styles.addEducationBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText type="smallBold">+ Add another education</ThemedText>
                </Pressable>

                {documentError ? (
                  <ThemedText type="small" style={styles.error}>
                    {documentError}
                  </ThemedText>
                ) : null}
              </>
            ) : null}

            {activeSection === 'job' ? (
              <>
                <Field
                  label="Job title"
                  onChangeText={(value) => updateField('job_title', value)}
                  placeholder="e.g. Software engineer"
                  required
                  theme={theme}
                  value={form.job_title}
                />
                <Field
                  label="Employer name"
                  onChangeText={(value) => updateField('employer_name', value)}
                  placeholder="Company name"
                  required
                  theme={theme}
                  value={form.employer_name}
                />
                <Field
                  label="Years of experience"
                  onChangeText={(value) => updateField('years_of_experience', value)}
                  placeholder="e.g. 3"
                  required
                  theme={theme}
                  value={form.years_of_experience}
                />
              </>
            ) : null}

            {activeSection === 'other' ? (
              <Field
                label="Other information"
                multiline
                onChangeText={(value) => updateField('other_information', value)}
                placeholder="Share any other relevant details"
                required
                theme={theme}
                value={form.other_information}
              />
            ) : null}

            {error ? (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              disabled={saveProfile.isPending || uploadDocument.isPending}
              onPress={onSave}
              style={[
                styles.button,
                {
                  opacity: saveProfile.isPending || uploadDocument.isPending ? 0.6 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                {saveProfile.isPending
                  ? passportPicked || cnicPicked || hasEducationFiles
                    ? 'Saving and uploading…'
                    : 'Saving…'
                  : activeSection === 'other'
                    ? 'Save and go to dashboard'
                    : 'Continue'}
              </ThemedText>
            </Pressable>
            </StudentSurface>
          </>
        )}
      </StudentScreen>

      {Platform.OS === 'android' && calendarOpen ? (
        <DateTimePicker
          display="calendar"
          maximumDate={maxBirthDate}
          minimumDate={MIN_BIRTH_DATE}
          mode="date"
          onChange={onPickDate}
          value={parseDate(form.date_of_birth)}
        />
      ) : null}

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => updateField('gender', value as Gender)}
        options={GENDER_SELECT_OPTIONS}
        selected={form.gender}
        title="Gender"
        visible={openSheet === 'gender'}
      />

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => onSectionChange(value as ProfileSection)}
        options={INFORMATION_SELECT_OPTIONS}
        selected={activeSection}
        title="Information type"
        visible={openSheet === 'information'}
      />

      <SelectSheet
        onClose={() => {
          setOpenSheet(null);
          setEducationLevelEntryKey(null);
        }}
        onSelect={(value) => {
          if (educationLevelEntryKey) {
            updateEducation(educationLevelEntryKey, { education_level: value });
          }
          setEducationLevelEntryKey(null);
        }}
        options={educationLevelOptions}
        selected={educationLevelEntry?.education_level ?? null}
        title="Education level"
        visible={openSheet === 'education_level'}
      />

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => updateField('nationality', value)}
        options={nationalityOptions}
        searchPlaceholder="Search nationality"
        searchable
        selected={form.nationality}
        title="Nationality"
        visible={openSheet === 'nationality'}
      />

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => {
          const nextCities = citiesForCountry(value);
          setForm((current) => ({
            ...current,
            country_of_residence: value,
            city: nextCities.includes(current.city) ? current.city : '',
          }));
        }}
        options={COUNTRY_OPTIONS}
        searchPlaceholder="Search country"
        searchable
        selected={form.country_of_residence}
        title="Country of residence"
        visible={openSheet === 'country'}
      />

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => updateField('city', value)}
        options={cityOptions}
        searchPlaceholder="Search city"
        searchable
        selected={form.city}
        title={form.country_of_residence ? `City in ${form.country_of_residence}` : 'City'}
        visible={openSheet === 'city'}
      />

      <SelectSheet
        onClose={() => setOpenSheet(null)}
        onSelect={(iso) => setDialIso(iso)}
        options={DIAL_OPTIONS}
        searchPlaceholder="Search country or code"
        searchable
        selected={dialIso}
        title="Country code"
        visible={openSheet === 'dial'}
      />

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setCalendarOpen(false)}
          transparent
          visible={calendarOpen}>
          <View style={styles.calendarOverlay}>
            <Pressable onPress={() => setCalendarOpen(false)} style={styles.calendarBackdrop} />
            <View style={[styles.calendarSheet, { backgroundColor: theme.background }]}>
              <View style={styles.calendarHeader}>
                <ThemedText type="smallBold">Date of birth</ThemedText>
                <Pressable onPress={() => setCalendarOpen(false)} hitSlop={8}>
                  <ThemedText type="smallBold">Done</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                display="inline"
                maximumDate={maxBirthDate}
                minimumDate={MIN_BIRTH_DATE}
                mode="date"
                onChange={onPickDate}
                themeVariant="light"
                value={parseDate(form.date_of_birth)}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
  onChangeText?: (value: string) => void;
  editable?: boolean;
  multiline?: boolean;
  required?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Field({
  label,
  value,
  placeholder,
  theme,
  onChangeText,
  editable = true,
  multiline = false,
  required = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
        {required ? <ThemedText style={styles.req}> *</ThemedText> : null}
      </ThemedText>
      <TextInput
        autoCapitalize={autoCapitalize}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
            opacity: editable ? 1 : 0.72,
          },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBack: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    marginBottom: Spacing.one,
  },
  formCard: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 20,
  },
  formHead: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    marginBottom: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  formHeadTitle: {
    fontSize: 18,
    flexShrink: 1,
  },
  sectionSelect: {
    maxWidth: '52%',
    minWidth: 148,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionHint: {
    lineHeight: 18,
    fontSize: 13,
  },
  req: {
    color: '#D92D20',
    textTransform: 'none',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
    fontSize: 16,
    justifyContent: 'center',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    borderRadius: 12,
    paddingTop: 13,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneInput: {
    flex: 1,
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#ffffff',
  },
  docUploadBtn: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  educationCard: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  educationCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  removeEducation: {
    color: '#D92D20',
  },
  addEducationBtn: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  error: {
    color: '#D92D20',
  },
  success: {
    color: '#039855',
  },
  calendarOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  calendarBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  calendarSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.two,
  },
});
