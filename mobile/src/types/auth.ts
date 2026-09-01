export type AccountType = 'student' | 'consultant' | 'super_admin' | 'admin' | 'staff';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
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
};

export type ChatDepartment = {
  value: string;
  label: string;
};

export type ChatConversation = {
  id: number;
  department?: string | null;
  department_label?: string | null;
  other_user: ChatUser;
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

export type ChatMessage = {
  id: number;
  body: string;
  mine: boolean;
  sender: {
    id: number;
    name: string;
  };
  created_at: string | null;
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
  consultant?: ConsultantSummary;
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

export type ApplicationStatusResponse = {
  application: StudentApplication;
  checklist: {
    documents: ApplicationChecklistItem;
    charge_receipts: ApplicationChecklistItem;
  };
  preparation_available: boolean;
  interview_available: boolean;
  current_status: string;
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
