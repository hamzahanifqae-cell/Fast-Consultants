import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { RejectionFeedback } from '@/components/student/rejection-feedback';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, StudentDocument } from '@/types/auth';

type DocumentOption = {
  value: DocumentType;
  label: string;
  requirements: string[];
  titlePlaceholder: string;
};

const DOCUMENT_TYPES: DocumentOption[] = [
  {
    value: 'passport',
    label: 'Passport',
    titlePlaceholder: 'e.g. Passport bio page',
    requirements: [
      'Clear scan or photo of passport bio page',
      'All details must be readable',
      'PDF, JPG, or PNG preferred',
    ],
  },
  {
    value: 'cnic',
    label: 'CNIC',
    titlePlaceholder: 'e.g. CNIC front',
    requirements: [
      'Clear scan or photo of your CNIC',
      'All details must be readable',
      'PDF, JPG, or PNG preferred',
    ],
  },
  {
    value: 'metric',
    label: 'Metric (Matric)',
    titlePlaceholder: 'e.g. Matric certificate',
    requirements: [
      'Matric / SSC certificate or mark sheet',
      'Board name and roll number should be visible',
      'Upload front side clearly',
    ],
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    titlePlaceholder: 'e.g. Intermediate certificate',
    requirements: [
      'Intermediate / HSSC certificate or mark sheet',
      'Board name and roll number should be visible',
      'Upload front side clearly',
    ],
  },
  {
    value: 'transcript',
    label: 'Transcript',
    titlePlaceholder: 'e.g. University transcript',
    requirements: [
      'Official academic transcript',
      'All pages if more than one',
      'University stamp/seal should be visible if available',
    ],
  },
  {
    value: 'degree_certificate',
    label: 'Degree certificate',
    titlePlaceholder: 'e.g. Bachelor degree',
    requirements: [
      'Final degree / provisional certificate',
      'Student name and degree title must be clear',
      'PDF or clear photo',
    ],
  },
  {
    value: 'diploma',
    label: 'Diploma',
    titlePlaceholder: 'e.g. Diploma certificate',
    requirements: [
      'Diploma certificate or mark sheet',
      'Student name and program title must be clear',
      'PDF or clear photo',
    ],
  },
  {
    value: 'english_test',
    label: 'IELTS score',
    titlePlaceholder: 'e.g. IELTS TRF',
    requirements: [
      'IELTS Test Report Form (TRF)',
      'Test date and overall score visible',
      'Upload full report if possible',
    ],
  },
  {
    value: 'recommendation_letter',
    label: 'Recommendation letter',
    titlePlaceholder: 'e.g. Teacher recommendation',
    requirements: [
      'Signed recommendation letter',
      'On letterhead if available',
      'PDF preferred',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    titlePlaceholder: 'e.g. Experience letter',
    requirements: [
      'Any supporting document for your application',
      'Use a clear file name in the title',
      'PDF, JPG, PNG, DOC, or DOCX',
    ],
  },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentDocumentsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isStudent = user?.roles.includes('student') ?? false;

  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = useMemo(
    () => DOCUMENT_TYPES.find((option) => option.value === documentType) ?? null,
    [documentType],
  );

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async () => {
      if (!documentType) {
        throw new Error('Please select a document type.');
      }
      if (!editingId && (!pickedUri || !pickedName)) {
        throw new Error('Please choose a file first.');
      }

      const formData = new FormData();
      formData.append('type', documentType);
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      if (pickedUri && pickedName) {
        formData.append('file', {
          uri: pickedUri,
          name: pickedName,
          type: pickedMime ?? 'application/octet-stream',
        } as unknown as Blob);
      }

      const path = editingId ? `/student/documents/${editingId}` : '/student/documents';
      const { data } = await api.post<{ data: StudentDocument }>(path, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return data.data;
    },
    onSuccess: async () => {
      setError(null);
      setEditingId(null);
      setTitle('');
      setPickedName(null);
      setPickedUri(null);
      setPickedMime(null);
      await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => {
            setError(
        getApiErrorMessage(err, editingId ? 'Could not update the document.' : 'Could not upload the document.'),
      );
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/student/documents/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (editingId === id) {
        setEditingId(null);
        setTitle('');
        setPickedName(null);
        setPickedUri(null);
        setPickedMime(null);
      }
      setError(null);
            await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not delete the document.'));
    },
  });
  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  async function pickDocument() {
    setError(null);
    
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
    setPickedUri(asset.uri);
    setPickedName(asset.name);
    setPickedMime(asset.mimeType ?? null);
  }

  function selectType(option: DocumentOption) {
    setDocumentType(option.value);
    setDropdownOpen(false);
    setError(null);
        if (!editingId) {
      setTitle('');
      setPickedName(null);
      setPickedUri(null);
      setPickedMime(null);
    }
  }

  function startEdit(document: StudentDocument) {
    setEditingId(document.id);
    setDocumentType(document.type);
    setTitle(document.title);
    setPickedName(null);
    setPickedUri(null);
    setPickedMime(null);
    setDropdownOpen(false);
    setError(null);
      }

  const canUpload =
    Boolean(documentType) &&
    (editingId != null || Boolean(pickedUri)) &&
    !uploadDocument.isPending;

  return (
    <StudentScreen
      showBack
      title="Documents">
          <ThemedText type="smallBold">Document type</ThemedText>
          <Pressable
            onPress={() => setDropdownOpen((open) => !open)}
            style={[styles.dropdown, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">
              {selectedOption?.label ?? 'Select document type'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {dropdownOpen ? '▲' : '▼'}
            </ThemedText>
          </Pressable>

          {dropdownOpen ? (
            <ThemedView style={[styles.dropdownMenu, { backgroundColor: theme.backgroundElement }]}>
              {DOCUMENT_TYPES.map((option) => {
                const selected = documentType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => selectType(option)}
                    style={[
                      styles.dropdownItem,
                      selected ? { backgroundColor: theme.backgroundSelected } : null,
                    ]}>
                    <ThemedText type="small">{option.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ThemedView>
          ) : null}

          {selectedOption ? (
            <ThemedView style={[styles.requirementsCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Required for {selectedOption.label}</ThemedText>
              {selectedOption.requirements.map((item) => (
                <ThemedText key={item} type="small" themeColor="textSecondary">
                  • {item}
                </ThemedText>
              ))}

              <View style={styles.fieldGap}>
                <ThemedText type="smallBold">Title (optional)</ThemedText>
                <TextInput
                  onChangeText={setTitle}
                  placeholder={selectedOption.titlePlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { backgroundColor: theme.background, color: theme.text },
                  ]}
                  value={title}
                />
              </View>

              <Pressable
                onPress={() => void pickDocument()}
                style={[styles.pickButton, { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold">
                  {pickedName ? 'Change file' : editingId ? 'Replace file (optional)' : 'Choose file'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {pickedName ??
                    (editingId
                      ? 'Leave empty to keep the current file'
                      : 'PDF, JPG, PNG, DOC, DOCX (max 10 MB)')}
                </ThemedText>
              </Pressable>

              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                disabled={!canUpload}
                onPress={() => uploadDocument.mutate()}
                style={[styles.button, { opacity: canUpload ? 1 : 0.6 }]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {uploadDocument.isPending
                    ? editingId
                      ? 'Saving…'
                      : 'Uploading…'
                    : editingId
                      ? 'Save changes'
                      : `Upload ${selectedOption.label}`}
                </ThemedText>
              </Pressable>
              {editingId ? (
                <Pressable
                  onPress={() => {
                    setEditingId(null);
                    setTitle('');
                    setPickedName(null);
                    setPickedUri(null);
                    setPickedMime(null);
                                        setError(null);
                  }}
                  style={[styles.pickButton, { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">Cancel edit</ThemedText>
                </Pressable>
              ) : null}
            </ThemedView>
          ) : null}

          <ThemedText type="subtitle">Uploaded documents</ThemedText>
          {documentsQuery.isLoading ? (
            <PageLoader compact message="Loading your documents…" />
          ) : null}

          {documentsQuery.data?.length ? (
            documentsQuery.data.map((document) => {
              const pastel =
                document.status === 'approved'
                  ? theme.cardTeal
                  : document.status === 'rejected'
                    ? theme.cardCoral
                    : theme.cardGold;

              return (
                <View
                  key={document.id}
                  style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.documentHeader}>
                    <View style={styles.documentMeta}>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {document.status === 'rejected' && document.rejection_reason
                          ? document.type_label
                          : `${document.type_label}, ${document.status_label}`}
                      </ThemedText>
                      <ThemedText type="subtitle" style={styles.cardTitle}>
                        {document.title}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {document.original_name}, {formatBytes(document.file_size)}
                      </ThemedText>
                      {document.status === 'rejected' && document.rejection_reason ? (
                        <RejectionFeedback reason={document.rejection_reason} />
                      ) : null}
                    </View>
                    <View style={[styles.avatar, { backgroundColor: pastel }]}>
                      <ThemedText style={styles.avatarGlyph}>
                        {document.status === 'approved'
                          ? '✓'
                          : document.status === 'rejected'
                            ? '✗'
                            : '📄'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={[styles.footerBar, { backgroundColor: pastel }]}>
                    {document.status === 'pending' || document.status === 'rejected' ? (
                      <View style={styles.footerActions}>
                        <Pressable
                          disabled={uploadDocument.isPending || deleteDocument.isPending}
                          onPress={() => startEdit(document)}>
                          <ThemedText type="caption" style={styles.barText}>
                            Edit
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={uploadDocument.isPending || deleteDocument.isPending}
                          onPress={() => deleteDocument.mutate(document.id)}>
                          <ThemedText type="caption" style={styles.barText}>
                            Delete
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : (
                      <ThemedText type="caption" style={styles.barText}>
                        {document.status_label}
                      </ThemedText>
                    )}
                    <ThemedText type="caption" style={styles.barText}>
                      ›
                    </ThemedText>
                  </View>
                </View>
              );
            })
          ) : documentsQuery.isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary">
              No documents uploaded yet.
            </ThemedText>
          )}
        </StudentScreen>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownMenu: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  requirementsCard: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fieldGap: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  input: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  pickButton: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: 4,
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: Spacing.one,
  },
  buttonText: { color: '#ffffff' },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 14,
  },
  documentMeta: {
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
  footerActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  barText: {
    fontWeight: '700',
  },
  error: { color: '#D92D20' },
  success: { color: '#039855' },
});
