export type AccountType = 'student' | 'consultant' | 'super_admin' | 'admin' | 'staff';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  roles: string[];
  staff_department?: string | null;
  staff_department_label?: string | null;
  permissions?: string[];
  is_super_admin?: boolean;
  is_admin?: boolean;
  is_staff?: boolean;
  is_student?: boolean;
  is_organization?: boolean;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type Department = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
};

export type InformationCategory = 'education' | 'job' | 'other';

export type StudentEducation = {
  id?: number | null;
  education_level: string;
  institution_name: string;
  field_of_study: string;
  graduation_year: string;
};

export type StudentProfile = {
  name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  nationality: string | null;
  country_of_residence: string | null;
  city: string | null;
  address: string | null;
  passport_number: string | null;
  cnic_number: string | null;
  information_category: InformationCategory | null;
  education_level: string | null;
  institution_name: string | null;
  field_of_study: string | null;
  graduation_year: string | null;
  educations?: StudentEducation[];
  job_title: string | null;
  employer_name: string | null;
  years_of_experience: string | null;
  other_information: string | null;
};

export type ConsultantSummary = {
  id: number;
  name: string;
  email: string;
};

export type ChatUser = {
  id: number | null;
  name: string | null;
  email: string | null;
  phone?: string | null;
};

export type ChatDepartment = {
  value: string;
  label: string;
};

export type ChatConversation = {
  id: number;
  kind?: 'student_department' | 'staff_dm';
  department?: string | null;
  department_label?: string | null;
  other_user: ChatUser & {
    staff_department?: string | null;
    staff_department_label?: string | null;
  };
  last_message: {
    id: number;
    body: string;
    created_at: string | null;
    mine: boolean;
  } | null;
  last_message_at: string | null;
  other_user_typing?: boolean;
  unread_count?: number;
  is_blocked?: boolean;
};

export type ChatStudentBlock = {
  student_id: number;
  student: {
    id: number | null;
    name: string | null;
    email: string | null;
  };
  blocked_by: {
    id: number;
    name: string;
    email: string;
  } | null;
  blocked_at: string | null;
};

export type ChatMessage = {
  id: number;
  body: string | null;
  mine: boolean;
  sender: {
    id: number;
    name: string;
  };
  created_at: string | null;
  attachment?: {
    name: string | null;
    mime_type: string | null;
    size: number | null;
    download_path: string;
  } | null;
};

export type DocumentType =
  | 'passport'
  | 'cnic'
  | 'metric'
  | 'intermediate'
  | 'transcript'
  | 'degree_certificate'
  | 'diploma'
  | 'english_test'
  | 'recommendation_letter'
  | 'other';

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export type StudentDocument = {
  id: number;
  type: DocumentType;
  type_label: string;
  title: string;
  original_name: string;
  mime_type: string | null;
  file_size: number;
  status: DocumentStatus;
  status_label: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  student?: {
    id: number;
    name: string;
    email: string;
  };
};

export type UniversityRequiredDocument = {
  type: DocumentType;
  label: string;
};

export type University = {
  id: number;
  name: string;
  country: string;
  city: string | null;
  description: string | null;
  is_visible_to_students: boolean;
  required_documents: UniversityRequiredDocument[];
  selection_source?: 'staff_shared' | 'student_selected' | null;
  notes?: string | null;
  consultant?: ConsultantSummary;
  created_at: string | null;
};

export type UniversitySuggestion = {
  id: number;
  country: string;
  name: string;
  city: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  status_label: string;
  university_id: number | null;
  university?: {
    id: number;
    name: string;
    country: string;
    city: string | null;
  } | null;
  student?: {
    id: number;
    name: string;
    email: string;
  } | null;
  reviewed_by?: {
    id: number;
    name: string;
    email: string;
  } | null;
  reviewed_at: string | null;
  created_at: string | null;
};

export type ChargeReceiptStatus =
  | 'awaiting_student'
  | 'awaiting_review'
  | 'approved'
  | 'rejected';

export type ChargeReceiptFile = {
  original_name: string;
  mime_type: string | null;
  file_size: number | null;
};

export type ChargeReceipt = {
  id: number;
  title: string;
  amount: string | null;
  currency: string | null;
  notes: string | null;
  status: ChargeReceiptStatus;
  status_label: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  consultant_file: ChargeReceiptFile;
  student_file: ChargeReceiptFile | null;
  consultant?: ConsultantSummary;
  student?: ConsultantSummary;
  created_at: string | null;
};

export type FormTemplateStatus =
  | 'awaiting_student'
  | 'awaiting_review'
  | 'approved'
  | 'rejected';

export type FormTemplateField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox';
  required: boolean;
};

export type FormTemplateDefinition = {
  key: string;
  title: string;
  letter_body: string;
  fields: FormTemplateField[];
};

export type FormTemplateAnswers = Record<string, string | boolean>;

export type FormTemplateAssignment = {
  id: number;
  template_key: string;
  title: string;
  instructions: string | null;
  letter_body: string;
  fields: FormTemplateField[];
  answers: FormTemplateAnswers | null;
  status: FormTemplateStatus;
  status_label: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  sender?: ConsultantSummary | null;
  student?: ConsultantSummary;
  created_at: string | null;
};

export type StudentSummary = ConsultantSummary;

export type ApplicationStage =
  | 'documents_and_charges'
  | 'preparation'
  | 'interview'
  | 'completed';

export type InterviewStatus =
  | 'not_scheduled'
  | 'scheduled'
  | 'cancelled'
  | 'completed'
  | 'passed'
  | 'failed';

export type ApplicationChecklistItem = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  accepted: boolean;
};

export type UniversityDocumentsChecklist = {
  required: number;
  covered: number;
  pending: number;
  action_needed: number;
  complete: boolean;
  missing: Array<{
    type: DocumentType;
    label: string;
    status: 'missing' | 'pending' | 'rejected' | 'approved';
  }>;
};

export type UrgentDocumentsChecklist = {
  required: number;
  covered: number;
  pending: number;
  action_needed: number;
  complete: boolean;
  missing: Array<{
    id: number;
    type: DocumentType;
    label: string;
    status: 'missing' | 'pending' | 'rejected' | 'approved';
    note: string | null;
  }>;
};

export type StudentApplication = {
  id: number;
  stage: ApplicationStage;
  stage_label: string;
  everything_accepted: boolean;
  preparation: {
    title: string | null;
    body: string | null;
    unlocked_at: string | null;
    completed_at: string | null;
  };
  interview: {
    status: InterviewStatus;
    status_label: string;
    at: string | null;
    mode: string | null;
    location: string | null;
    notes: string | null;
    unlocked_at: string | null;
    followup_preference: 'want_another' | 'decline_another' | null;
    followup_preference_label: string | null;
    followup_preference_at: string | null;
    meeting_ended_at: string | null;
  };
  student?: StudentSummary;
  consultant?: StudentSummary | null;
  updated_at: string | null;
};

export type ApplicationHandoff = {
  documents_approved: boolean;
  universities_shared: boolean;
  fees_cleared: boolean;
};

export type ApplicationStatusResponse = {
  application: StudentApplication;
  checklist: {
    documents: ApplicationChecklistItem;
    urgent_documents?: UrgentDocumentsChecklist;
    university_documents?: UniversityDocumentsChecklist;
    charge_receipts: ApplicationChecklistItem;
  };
  handoff: ApplicationHandoff;
  preparation_available: boolean;
  interview_available: boolean;
  current_status: string;
};

export type UrgentDocumentRequest = {
  id: number;
  student_id: number;
  document_type: DocumentType;
  document_type_label: string;
  note: string | null;
  requested_by: number;
  resolved_at: string | null;
  created_at: string | null;
  is_open: boolean;
  requester?: StudentSummary | null;
};

export type InterviewVideoRoom = {
  room_name: string;
  join_url: string;
  display_name: string;
  provider: 'jitsi';
  student_name: string | null;
};

export type InterviewCallStatus = {
  interview_at: string | null;
  student_joined: boolean;
  staff_joined: boolean;
  both_joined: boolean;
  alarm_active: boolean;
  seconds_until_start: number | null;
};

export type VisaAppointment = {
  id: number;
  scheduled_at: string | null;
  mode: string | null;
  location: string | null;
  embassy: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  status_label: string;
  student?: StudentSummary;
  created_at: string | null;
};

export type StudentNotification = {
  id: number;
  type: string | null;
  action: string | null;
  conversation_id: number | null;
  message: string;
  read_at: string | null;
  created_at: string | null;
};

export type StudentNotificationsResponse = {
  data: StudentNotification[];
  unread_count: number;
};
