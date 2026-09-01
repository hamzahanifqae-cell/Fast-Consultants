import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL, api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentDocument, StudentSummary } from '@/types/auth';

export default function ConsultantDocumentsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    uri: string;
    mimeType?: string | null;
  } | null>(null);

  const studentId = selected?.id ?? null;

  const documentsQuery = useQuery({
    queryKey: ['consultant-documents', studentId],
    enabled: Boolean(token) && isConsultant && Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/consultant/documents', {
        params: { student_id: studentId },
      });
      return data.data;
    },
  });

  const docs = documentsQuery.data ?? [];
  const pendingDocuments = useMemo(
    () => docs.filter((document) => document.status === 'pending'),
    [docs],
  );
  const approvedDocuments = useMemo(
    () => docs.filter((document) => document.status === 'approved'),
    [docs],
  );

  const updateDocumentStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      rejection_reason,
    }: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      const { data } = await api.patch<{ data: StudentDocument }>(
        `/consultant/documents/${id}/status`,
        { status, rejection_reason },
      );
      return data.data;
    },
    onSuccess: async () => {
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] });
    },
    onError: (err) => {
      setReviewError(getApiErrorMessage(err, 'Could not update document status.'));
    },
  });

  async function shareDownloadedFile(
    uri: string,
    options: { title: string; mimeType?: string | null },
  ) {
    if (!(await Sharing.isAvailableAsync())) {
      setReviewError('Sharing is unavailable on this device.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: options.mimeType ?? undefined,
      dialogTitle: options.title,
    });
  }

  async function openDocument(document: StudentDocument) {
    if (!token) return;
    setOpeningId(document.id);
    setReviewError(null);
    try {
      const target = `${FileSystem.cacheDirectory}doc-${document.id}-${document.original_name}`;
      const result = await FileSystem.downloadAsync(
        `${API_URL}/consultant/documents/${document.id}/download`,
        target,
        { headers: { Authorization: `Bearer ${token}`, Accept: '*/*' } },
      );

      const isImage =
        document.mime_type?.startsWith('image/') ||
        /\.(jpe?g|png|gif|webp)$/i.test(document.original_name);

      if (isImage) {
        setPreview({
          title: document.original_name || document.title,
          uri: result.uri,
          mimeType: document.mime_type,
        });
        return;
      }

      const shared = await Sharing.isAvailableAsync();
      if (shared) {
        await shareDownloadedFile(result.uri, {
          title: document.title,
          mimeType: document.mime_type,
        });
      } else {
        setReviewError('Could not open this file on this device. Try again on web.');
      }
    } catch (err) {
      setReviewError(getApiErrorMessage(err, 'Could not open this document.'));
    } finally {
      setOpeningId(null);
    }
  }

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  return (
    <StudentScreen
      showBack
      title="Documents">
      <DocumentPreviewModal
        mimeType={preview?.mimeType}
        onClose={() => setPreview(null)}
        onDownload={
          preview
            ? () => {
                void shareDownloadedFile(preview.uri, {
                  title: preview.title,
                  mimeType: preview.mimeType,
                });
              }
            : undefined
        }
        title={preview?.title ?? 'Document'}
        uri={preview?.uri ?? null}
        visible={Boolean(preview)}
      />
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={setSelected}
        onClear={() => setSelected(null)}>
        <StudentSurface style={{ backgroundColor: theme.backgroundElement }}>
          {reviewError ? (
            <ThemedText type="small" style={styles.error}>
              {reviewError}
            </ThemedText>
          ) : null}

          {approvedDocuments.length ? (
            <>
              <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
                Approved documents
              </ThemedText>
              {approvedDocuments.map((document) => (
                <View
                  key={`approved-${document.id}`}
                  style={[styles.reviewItem, { backgroundColor: theme.inputFill }]}>
                  <ThemedText type="smallBold">{document.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {document.type_label}, {document.original_name}
                  </ThemedText>
                  <Pressable
                    disabled={openingId === document.id}
                    onPress={() => void openDocument(document)}
                    style={[styles.button, styles.view]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {openingId === document.id ? 'Opening…' : 'View'}
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          {pendingDocuments.length ? (
            pendingDocuments.map((document) => {
              const rejectionReason = rejectionReasons[document.id] ?? '';

              return (
                <View
                  key={document.id}
                  style={[styles.reviewItem, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Pending review
                  </ThemedText>
                  <ThemedText type="smallBold">{document.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {document.type_label}, {document.original_name}
                  </ThemedText>
                  <Pressable
                    disabled={openingId === document.id}
                    onPress={() => void openDocument(document)}
                    style={[styles.button, styles.view]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {openingId === document.id ? 'Opening…' : 'View file'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    disabled={updateDocumentStatus.isPending}
                    onPress={() =>
                      updateDocumentStatus.mutate({ id: document.id, status: 'approved' })
                    }
                    style={[styles.button, styles.approve]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      Approve document
                    </ThemedText>
                  </Pressable>

                  <View style={[styles.rejectCard, { borderColor: Brand.dangerMuted }]}>
                    <ThemedText type="smallBold">Reject with reason</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Required when sending back to the student
                    </ThemedText>
                    <TextInput
                      multiline
                      onChangeText={(value) =>
                        setRejectionReasons((current) => ({
                          ...current,
                          [document.id]: value,
                        }))
                      }
                      placeholder="e.g. Bio page is blurry, upload a clearer scan"
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.input,
                        { backgroundColor: theme.background, color: theme.text },
                      ]}
                      value={rejectionReason}
                    />
                    <ThemedText type="caption" themeColor="textSecondary">
                      The student will see this message on their Documents page.
                    </ThemedText>
                    <Pressable
                      disabled={
                        updateDocumentStatus.isPending || rejectionReason.trim().length === 0
                      }
                      onPress={() =>
                        updateDocumentStatus.mutate({
                          id: document.id,
                          status: 'rejected',
                          rejection_reason: rejectionReason.trim(),
                        })
                      }
                      style={[
                        styles.button,
                        styles.reject,
                        {
                          opacity:
                            updateDocumentStatus.isPending || rejectionReason.trim().length === 0
                              ? 0.55
                              : 1,
                        },
                      ]}>
                      <ThemedText type="smallBold" style={styles.buttonText}>
                        Reject document
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No pending documents for this student.
            </ThemedText>
          )}

          <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
            All documents
          </ThemedText>
          {docs.map((document) => (
            <View
              key={`all-${document.id}`}
              style={[styles.reviewItem, { backgroundColor: theme.inputFill }]}>
              <ThemedText type="smallBold">{document.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {document.type_label}, {document.status_label}
              </ThemedText>
              <Pressable
                disabled={openingId === document.id}
                onPress={() => void openDocument(document)}
                style={[styles.button, styles.view]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {openingId === document.id ? 'Opening…' : 'View'}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </StudentSurface>
      </DepartmentStudentGate>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  reviewItem: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  rejectCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  input: {
    borderRadius: 14,
    minHeight: 88,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  approve: { backgroundColor: Brand.success },
  reject: { backgroundColor: Brand.danger },
  view: { backgroundColor: Brand.primary },
  buttonText: { color: '#fff' },
  error: { color: '#D92D20' },
});
