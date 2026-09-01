import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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

function withAlpha(hex: string, alphaHex: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alphaHex}`;
  }
  return hex;
}

function StepProgressBar({
  color,
  label,
  percent,
}: {
  color: string;
  label: string;
  percent: number;
}) {
  const width = `${Math.max(percent, percent > 0 ? 8 : 0)}%` as DimensionValue;

  return (
    <View style={styles.stepTrack}>
      <View pointerEvents="none" style={[styles.stepFillWrap, { width }]}>
        <LinearGradient
          colors={[withAlpha(color, 'E0'), color, withAlpha(color, 'B8')]}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ThemedText numberOfLines={1} style={styles.stepLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

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
  const currentStepColor = steps[currentProgressIndex]?.color ?? '#34d399';
  const currentStep = currentStudentStep(status, profile, appointments);
  const progressLabel = loading
    ? 'Updating progress…'
    : `${progressPercent}%, ${steps[currentProgressIndex]?.label ?? 'Progress'}`;

  return (
    <LinearGradient
      colors={['#7c3aed', '#4f46e5', '#1e293b']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.card}>
      <StepProgressBar
        color={currentStepColor}
        label={progressLabel}
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
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  stepTrack: {
    position: 'relative',
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  stepFillWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stepLabel: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#312e81',
  },
});
