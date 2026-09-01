import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StepProgressBar } from '@/components/student/step-progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  currentStudentStep,
  studentProgressPercent,
  studentProgressSteps,
} from '@/lib/student-journey-progress';
import type {
  ApplicationStatusResponse,
  StudentProfile,
  VisaAppointment,
} from '@/types/auth';

type Props = {
  status?: ApplicationStatusResponse;
  profile?: StudentProfile;
  appointments?: VisaAppointment[];
  loading?: boolean;
};

export function StudentProgressCard({
  status,
  profile,
  appointments = [],
  loading = false,
}: Props) {
  const steps = studentProgressSteps(status, profile, appointments);
  const progressPercent = studentProgressPercent(status, profile, appointments);
  const activeStepIndex = steps.findIndex((step) => !step.done);
  const currentProgressIndex =
    activeStepIndex === -1 ? steps.length - 1 : activeStepIndex;
  const currentStep = currentStudentStep(status, profile, appointments);
  const progressLabel = loading
    ? 'Updating progress…'
    : `${progressPercent}%, ${steps[currentProgressIndex]?.label ?? 'Progress'}`;

  return (
    <LinearGradient
      colors={[Brand.primaryStrong, Brand.primary, Brand.authMid]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.card}>
      <StepProgressBar
        label={progressLabel}
        loading={loading}
        percent={loading ? 0 : progressPercent}
      />

      <View style={styles.kicker}>
        <ThemedText style={styles.kickerText}>
          {currentStep.done ? 'Completed' : 'Current step'}
        </ThemedText>
      </View>

      <ThemedText style={styles.title}>{loading ? 'Loading your journey…' : currentStep.title}</ThemedText>
      <ThemedText style={styles.body}>{loading ? 'Fetching your latest application status.' : currentStep.body}</ThemedText>

      <Pressable
        disabled={loading}
        onPress={() => router.push(currentStep.href as Href)}
        style={({ pressed }) => [
          styles.button,
          pressed && !loading ? styles.buttonPressed : null,
          loading ? styles.buttonDisabled : null,
        ]}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {currentStep.label}
        </ThemedText>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    gap: 12,
    overflow: 'hidden',
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  kicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  kickerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Brand.primaryStrong,
  },
});
