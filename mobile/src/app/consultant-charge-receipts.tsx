import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { downloadAndOpenReceiptFile } from '@/lib/receipt-download';
import { useAuthStore } from '@/stores/auth-store';
import type { ChargeReceipt, StudentSummary } from '@/types/auth';
import { isOrganizationUser } from '@/lib/roles';

export default function ConsultantChargeReceiptsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const studentId = selected?.id ?? null;

  const receiptsQuery = useQuery({
    queryKey: ['consultant-charge-receipts', studentId],
    enabled: Boolean(token) && isConsultant && Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/consultant/charge-receipts', {
        params: { student_id: studentId },
      });
      return data.data;
    },
  });

  const createReceipt = useMutation({
    mutationFn: async () => {
      if (!studentId || !pickedUri || !pickedName) {
        throw new Error('Select a student and charge slip file.');
      }

      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('title', title.trim());
      if (amount.trim()) {
        formData.append('amount', amount.trim());
      }
      formData.append('currency', 'PKR');
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      formData.append('file', {
        uri: pickedUri,
        name: pickedName,
        type: pickedMime ?? 'application/octet-stream',
      } as unknown as Blob);

      const { data } = await api.post<{ data: ChargeReceipt }>(
        '/consultant/charge-receipts',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      return data.data;
    },
    onSuccess: async () => {
      setError(null);
            setTitle('');
      setAmount('');
      setNotes('');
      setPickedUri(null);
      setPickedName(null);
      setPickedMime(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-charge-receipts', studentId] });
    },
    onError: (err) => {
            setError(getApiErrorMessage(err, 'Could not upload the charge slip.'));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      rejection_reason,
    }: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      const { data } = await api.patch<{ data: ChargeReceipt }>(
        `/consultant/charge-receipts/${id}/status`,
        { status, rejection_reason },
      );
      return data.data;
    },
    onSuccess: async (_data, variables) => {
      setError(null);
      setRejectionReasons((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['consultant-charge-receipts', studentId] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not update slip status.'));
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    setPickedUri(asset.uri);
    setPickedName(asset.name);
    setPickedMime(asset.mimeType ?? null);
  }

  const canCreate =
    Boolean(studentId && title.trim() && pickedUri) && !createReceipt.isPending;

  return (
    <StudentScreen
      showBack
      title="Charge receipts">
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={setSelected}
        onClear={() => setSelected(null)}>
          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="subtitle">Send charge slip</ThemedText>

            <TextInput
              onChangeText={setTitle}
              placeholder="Title e.g. Application fee"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={title}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="Amount (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              value={amount}
            />
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder="Notes for the student (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              value={notes}
            />

            <Pressable
              onPress={() => void pickFile()}
              style={[styles.input, { backgroundColor: theme.background }]}>
              <ThemedText type="small">
                {pickedName ?? 'Choose charge slip file (PDF/JPG/PNG)'}
              </ThemedText>
            </Pressable>

            {error ? (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}

            <Pressable
              disabled={!canCreate}
              onPress={() => createReceipt.mutate()}
              style={[styles.button, { opacity: canCreate ? 1 : 0.6 }]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                {createReceipt.isPending ? 'Uploading…' : 'Send slip to student'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedText type="subtitle">Slips for this student</ThemedText>
          {receiptsQuery.isLoading ? <ActivityIndicator /> : null}

          {receiptsQuery.data?.length ? (
            receiptsQuery.data.map((receipt) => {
              const rejectionReason = rejectionReasons[receipt.id] ?? '';
              const awaitingReview = receipt.status === 'awaiting_review';

              return (
                <ThemedView
                  key={receipt.id}
                  style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{receipt.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {receipt.status_label}
                  </ThemedText>
                  {receipt.amount ? (
                    <ThemedText type="small">
                      Amount: {receipt.currency ?? 'PKR'} {receipt.amount}
                    </ThemedText>
                  ) : null}

                  <ThemedText type="small">
                    Your slip: {receipt.consultant_file?.original_name ?? 'Consultant slip'}
                  </ThemedText>
                  <Pressable
                    onPress={() =>
                      void downloadAndOpenReceiptFile(
                        `/consultant/charge-receipts/${receipt.id}/consultant-file`,
                        receipt.consultant_file?.original_name ?? receipt.title,
                        token,
                      ).catch((err) =>
                        setError(getApiErrorMessage(err, 'Could not open consultant slip.')),
                      )
                    }>
                    <ThemedText type="linkPrimary">Open consultant slip</ThemedText>
                  </Pressable>

                  {receipt.student_file ? (
                    <>
                      <ThemedText type="small">
                        Student slip: {receipt.student_file.original_name}
                      </ThemedText>
                      <Pressable
                        onPress={() =>
                          void downloadAndOpenReceiptFile(
                            `/consultant/charge-receipts/${receipt.id}/student-file`,
                            receipt.student_file!.original_name,
                            token,
                          ).catch((err) =>
                            setError(getApiErrorMessage(err, 'Could not open student slip.')),
                          )
                        }>
                        <ThemedText type="linkPrimary">Open student slip</ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Waiting for student to upload their slip.
                    </ThemedText>
                  )}

                  {receipt.status === 'rejected' && receipt.rejection_reason ? (
                    <ThemedText type="small" style={styles.error}>
                      Reason: {receipt.rejection_reason}
                    </ThemedText>
                  ) : null}

                  {awaitingReview ? (
                    <>
                      <TextInput
                        multiline
                        onChangeText={(value) =>
                          setRejectionReasons((current) => ({
                            ...current,
                            [receipt.id]: value,
                          }))
                        }
                        placeholder="Reason if rejecting"
                        placeholderTextColor={theme.textSecondary}
                        style={[
                          styles.input,
                          styles.multiline,
                          { backgroundColor: theme.background, color: theme.text },
                        ]}
                        value={rejectionReason}
                      />
                      <View style={styles.actions}>
                        <Pressable
                          disabled={updateStatus.isPending}
                          onPress={() =>
                            updateStatus.mutate({ id: receipt.id, status: 'approved' })
                          }
                          style={[styles.reviewButton, styles.approveButton]}>
                          <ThemedText type="smallBold" style={styles.buttonText}>
                            Approve ✓
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={
                            updateStatus.isPending || rejectionReason.trim().length === 0
                          }
                          onPress={() =>
                            updateStatus.mutate({
                              id: receipt.id,
                              status: 'rejected',
                              rejection_reason: rejectionReason.trim(),
                            })
                          }
                          style={[
                            styles.reviewButton,
                            styles.rejectButton,
                            {
                              opacity:
                                updateStatus.isPending || rejectionReason.trim().length === 0
                                  ? 0.6
                                  : 1,
                            },
                          ]}>
                          <ThemedText type="smallBold" style={styles.buttonText}>
                            Reject ✗
                          </ThemedText>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </ThemedView>
              );
            })
          ) : receiptsQuery.isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary">
              No charge slips for this student yet.
            </ThemedText>
          )}
      </DepartmentStudentGate>
        </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: 24,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  dropdown: {
    justifyContent: 'center',
  },
  menu: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    gap: 2,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonText: { color: '#ffffff' },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reviewButton: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 10,
  },
  approveButton: { backgroundColor: '#039855' },
  rejectButton: { backgroundColor: '#D92D20' },
  error: { color: '#D92D20' },
  success: { color: '#039855' },
});
