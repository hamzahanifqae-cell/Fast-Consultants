import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { API_URL, api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, StudentDocument, StudentSummary, UrgentDocumentRequest } from '@/types/auth';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'metric', label: 'Matric' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

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
  const [urgentTypes, setUrgentTypes] = useState<DocumentType[]>([]);
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

  const urgentQuery = useQuery({
    queryKey: ['consultant-urgent-documents', studentId],
    enabled: Boolean(token) && isConsultant && Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: UrgentDocumentRequest[] }>(
        '/consultant/urgent-documents',
        { params: { student_id: studentId, open_only: 1 } },
      );
      return data.data;
    },
  });

  const docs = documentsQuery.data ?? [];
  const openUrgent = urgentQuery.data ?? [];
  const pendingDocuments = useMemo(
    () => docs.filter((document) => document.status === 'pending'),
    [docs],
  );
  const approvedDocuments = useMemo(
    () => docs.filter((document) => document.status === 'approved'),
    [docs],
  );
  const openUrgentTypes = useMemo(
    () => new Set(openUrgent.map((item) => item.document_type)),
    [openUrgent],
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] }),
      ]);
    },
    onError: (err) => {
      setReviewError(getApiErrorMessage(err, 'Could not update document status.'));
    },
  });

  const requestUrgent = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/urgent-documents', {
        student_id: studentId,
        document_types: urgentTypes,
      });
    },
    onSuccess: async () => {
      setReviewError(null);
      setUrgentTypes([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] }),
      ]);
    },
    onError: (err) => {
      setReviewError(getApiErrorMessage(err, 'Could not request urgent documents.'));
    },
  });

  const resolveUrgent = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/consultant/urgent-documents/${id}/resolve`);
    },
    onSuccess: async () => {
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] });
    },
    onError: (err) => {
      setReviewError(getApiErrorMessage(err, 'Could not clear urgent request.'));
    },
  });

  function toggleUrgentType(type: DocumentType) {
    setUrgentTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }
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
        onClear={() => {
          setSelected(null);
          setUrgentTypes([]);
          setReviewError(null);
        }}>
        <StudentSurface style={{ backgroundColor: theme.backgroundElement }}>
          {reviewError ? (
            <ThemedText type="small" style={styles.error}>
              {reviewError}
            </ThemedText>
          ) : null}

          <ThemedText type="subtitle">Request urgent documents</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Student status returns to Documents and shows Urgent documents until these are approved.
          </ThemedText>
          {openUrgent.map((item) => (
            <View
              key={item.id}
              style={[styles.reviewItem, { backgroundColor: theme.inputFill, marginTop: Spacing.two }]}>
              <ThemedText type="smallBold">{item.document_type_label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.note || 'Open urgent request'}
              </ThemedText>
              <Pressable
                disabled={resolveUrgent.isPending}
                onPress={() => resolveUrgent.mutate(item.id)}
                style={[styles.button, styles.view]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Clear request
                </ThemedText>
              </Pressable>
            </View>
          ))}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {DOCUMENT_TYPES.map((item) => {
              const selectedType = urgentTypes.includes(item.value);
              const alreadyOpen = openUrgentTypes.has(item.value);
              return (
                <Pressable
                  key={item.value}
                  onPress={() => toggleUrgentType(item.value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: theme.border,
                      backgroundColor: selectedType || alreadyOpen ? theme.cardGold : theme.background,
                    },
                  ]}>
                  <ThemedText type="caption" style={{ fontWeight: '700' }}>
                    {item.label}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {alreadyOpen ? 'Requested' : selectedType ? 'Selected' : 'Select'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            disabled={requestUrgent.isPending || urgentTypes.length === 0}
            onPress={() => requestUrgent.mutate()}
            style={[
              styles.button,
              styles.approve,
              { opacity: requestUrgent.isPending || urgentTypes.length === 0 ? 0.55 : 1 },
            ]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {requestUrgent.isPending ? 'Requesting…' : 'Send urgent request'}
            </ThemedText>
          </Pressable>

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
                      Rejection note
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
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingRight: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    minWidth: 110,
    gap: 2,
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
    marginTop: Spacing.two,
  },
  button: {
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  approve: { backgroundColor: Brand.success },
  reject: { backgroundColor: Brand.danger },
  view: { backgroundColor: Brand.primary },
  buttonText: { color: '#fff' },
  error: { color: '#D92D20' },
});
