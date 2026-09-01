import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentProfile } from '@/types/auth';
import { isOrganizationUser } from '@/lib/roles';

type ConsultantStudentDetail = {
  id: number;
  profile: StudentProfile;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.text }}>
        {value?.trim() ? value : 'None'}
      </ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

export default function ConsultantStudentDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const studentId = Number(params.id);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const detailQuery = useQuery({
    queryKey: ['consultant-student', studentId],
    enabled: Boolean(token) && isConsultant && Number.isFinite(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: ConsultantStudentDetail }>(
        `/consultant/students/${studentId}`,
      );
      return data.data;
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  const profile = detailQuery.data?.profile;

  return (
    <StudentScreen
      showBack
      subtitle={profile?.email ?? 'Student profile'}
      title={profile?.name ?? 'Student'}>
      <StudentSurface style={{ backgroundColor: theme.backgroundElement }}>
        {detailQuery.isLoading ? <ActivityIndicator color={theme.text} /> : null}

        {profile ? (
          <View style={styles.grid}>
            <Section title="Personal">
              <Field label="Full name" value={profile.name} />
              <Field label="Email" value={profile.email} />
              <Field label="Phone" value={profile.phone} />
              <Field label="Date of birth" value={profile.date_of_birth} />
              <Field label="Gender" value={profile.gender} />
              <Field label="Nationality" value={profile.nationality} />
              <Field label="Country of residence" value={profile.country_of_residence} />
              <Field label="City" value={profile.city} />
              <Field label="Address" value={profile.address} />
              <Field label="Passport number" value={profile.passport_number} />
              <Field label="CNIC number" value={profile.cnic_number} />
            </Section>

            <Section title="Education">
              <Field label="Education level" value={profile.education_level} />
              <Field label="Institution name" value={profile.institution_name} />
              <Field label="Field of study" value={profile.field_of_study} />
              <Field label="Graduation year" value={profile.graduation_year} />
            </Section>

            <Section title="Job">
              <Field label="Job title" value={profile.job_title} />
              <Field label="Employer name" value={profile.employer_name} />
              <Field label="Years of experience" value={profile.years_of_experience} />
            </Section>

            <Section title="Other">
              <Field label="Other information" value={profile.other_information} />
            </Section>
          </View>
        ) : null}

        {!detailQuery.isLoading && !profile ? (
          <ThemedText type="small" themeColor="textSecondary">
            Could not load this student profile.
          </ThemedText>
        ) : null}
      </StudentSurface>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionRows: {
    gap: Spacing.three,
  },
  field: {
    gap: 4,
  },
});
