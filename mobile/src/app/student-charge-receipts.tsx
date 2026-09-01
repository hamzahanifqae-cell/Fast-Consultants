import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { RejectionFeedback } from '@/components/student/rejection-feedback';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { downloadAndOpenReceiptFile } from '@/lib/receipt-download';
import { useAuthStore } from '@/stores/auth-store';
import type { ChargeReceipt } from '@/types/auth';

export default function StudentChargeReceiptsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: ['student-charge-receipts'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/student/charge-receipts');
      return data.data;
    },
  });

  const uploadSlip = useMutation({
    mutationFn: async ({
      id,
      uri,
      name,
      mime,
    }: {
      id: number;
      uri: string;
      name: string;
      mime: string | null;
    }) => {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name,
        type: mime ?? 'application/octet-stream',
      } as unknown as Blob);

      const { data } = await api.post<{ data: ChargeReceipt }>(
        `/student/charge-receipts/${id}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      return data.data;
    },
    onSuccess: async () => {
      setError(null);
            setUploadingId(null);
      await queryClient.invalidateQueries({ queryKey: ['student-charge-receipts'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => {
            setUploadingId(null);
      setError(getApiErrorMessage(err, 'Could not upload your slip.'));
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  async function pickAndUpload(receiptId: number) {
    setError(null);
    
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    setUploadingId(receiptId);
    uploadSlip.mutate({
      id: receiptId,
      uri: asset.uri,
      name: asset.name,
      mime: asset.mimeType ?? null,
    });
  }

  return (
    <StudentScreen
      showBack
      title="Charge receipts">
          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          {receiptsQuery.isLoading ? (
            <PageLoader compact message="Loading charge receipts…" />
          ) : null}

          {receiptsQuery.data?.length ? (
            receiptsQuery.data.map((receipt) => {
              const canUpload =
                receipt.status === 'awaiting_student' || receipt.status === 'rejected';
              const pastel =
                receipt.status === 'approved'
                  ? theme.cardTeal
                  : receipt.status === 'rejected'
                    ? theme.cardCoral
                    : theme.cardGold;

              return (
                <View
                  key={receipt.id}
                  style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardCopy}>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {receipt.status === 'rejected' && receipt.rejection_reason
                          ? `From ${receipt.consultant?.name ?? 'consultant'}`
                          : `From ${receipt.consultant?.name ?? 'consultant'}, ${receipt.status_label}`}
                      </ThemedText>
                      <ThemedText type="subtitle" style={styles.cardTitle}>
                        {receipt.title}
                      </ThemedText>
                      {receipt.amount ? (
                        <ThemedText type="caption" themeColor="textSecondary">
                          Amount: {receipt.currency ?? 'PKR'} {receipt.amount}
                        </ThemedText>
                      ) : null}
                      {receipt.notes ? <ThemedText type="small">{receipt.notes}</ThemedText> : null}
                      {receipt.status === 'rejected' && receipt.rejection_reason ? (
                        <RejectionFeedback reason={receipt.rejection_reason} />
                      ) : null}
                    </View>
                    <View style={[styles.avatar, { backgroundColor: pastel }]}>
                      <ThemedText style={styles.avatarGlyph}>💳</ThemedText>
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() =>
                        void downloadAndOpenReceiptFile(
                          `/student/charge-receipts/${receipt.id}/consultant-file`,
                          receipt.consultant_file?.original_name ?? receipt.title,
                          token,
                        ).catch((err) =>
                          setError(getApiErrorMessage(err, 'Could not open the consultant slip.')),
                        )
                      }>
                      <ThemedText type="smallBold">View consultant slip</ThemedText>
                    </Pressable>

                    {receipt.student_file ? (
                      <Pressable
                        onPress={() =>
                          void downloadAndOpenReceiptFile(
                            `/student/charge-receipts/${receipt.id}/student-file`,
                            receipt.student_file!.original_name,
                            token,
                          ).catch((err) =>
                            setError(getApiErrorMessage(err, 'Could not open your slip.')),
                          )
                        }>
                        <ThemedText type="smallBold">View your slip</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={[styles.footerBar, { backgroundColor: pastel }]}>
                    {canUpload ? (
                      <Pressable
                        disabled={uploadSlip.isPending && uploadingId === receipt.id}
                        onPress={() => void pickAndUpload(receipt.id)}>
                        <ThemedText type="caption" style={styles.barText}>
                          {uploadSlip.isPending && uploadingId === receipt.id
                            ? 'Uploading…'
                            : receipt.status === 'rejected'
                              ? 'Re-upload slip'
                              : 'Upload your slip'}
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText type="caption" style={styles.barText}>
                        {receipt.status === 'approved' ? 'Approved' : receipt.status_label}
                      </ThemedText>
                    )}
                    <ThemedText type="caption" style={styles.barText}>
                      ›
                    </ThemedText>
                  </View>
                </View>
              );
            })
          ) : receiptsQuery.isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary">
              No charge slips from your consultant yet.
            </ThemedText>
          )}
        </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 10,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 28,
    lineHeight: 34,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: 10,
  },
  footerBar: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barText: {
    fontWeight: '700',
  },
  error: { color: '#D92D20' },
  success: { color: '#039855' },
});
