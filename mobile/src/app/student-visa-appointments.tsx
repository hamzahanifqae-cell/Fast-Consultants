import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { VisaAppointment } from '@/types/auth';

function formatWhen(value: string | null): string {
  if (!value) {
    return 'To be confirmed';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function StudentVisaAppointmentsScreen() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  const appointments = appointmentsQuery.data ?? [];

  return (
    <StudentScreen
      showBack
      title="Visa appointments">
      {appointmentsQuery.isLoading ? <ActivityIndicator color={Brand.primary} /> : null}

      {!appointmentsQuery.isLoading && appointments.length === 0 ? (
        <StudentSurface>
          <ThemedText type="small" themeColor="textSecondary">
            No visa appointments yet. Your Visa department will schedule one when you are ready.
          </ThemedText>
        </StudentSurface>
      ) : null}

      {appointments.map((appointment) => (
        <StudentSurface key={appointment.id}>
          <View style={styles.row}>
            <ThemedText type="smallBold">{appointment.status_label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {formatWhen(appointment.scheduled_at)}
            </ThemedText>
          </View>
          {appointment.embassy ? (
            <ThemedText type="small" themeColor="textSecondary">
              Embassy: {appointment.embassy}
            </ThemedText>
          ) : null}
          {appointment.mode ? (
            <ThemedText type="small" themeColor="textSecondary">
              Mode: {appointment.mode}
            </ThemedText>
          ) : null}
          {appointment.location ? (
            <ThemedText type="small" themeColor="textSecondary">
              Location: {appointment.location}
            </ThemedText>
          ) : null}
          {appointment.notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              Notes: {appointment.notes}
            </ThemedText>
          ) : null}
        </StudentSurface>
      ))}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
});
