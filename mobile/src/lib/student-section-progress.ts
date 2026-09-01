import type {
  ApplicationStatusResponse,
  ChargeReceipt,
  StudentDocument,
  StudentProfile,
  University,
  VisaAppointment,
} from '@/types/auth';

export type SectionProgress = {
  percent: number;
  report: string;
  complete: boolean;
  meta: string;
  actionLabel: string;
};

function scoreFields(fields: Array<string | null | undefined>) {
  const total = fields.length;
  const filled = fields.filter((value) => Boolean(value && String(value).trim())).length;
  return {
    filled,
    total,
    percent: total === 0 ? 0 : Math.round((filled / total) * 100),
    complete: total > 0 && filled >= total,
  };
}

export function profileSectionProgress(profile: StudentProfile | undefined): SectionProgress {
  if (!profile) {
    return {
      percent: 0,
      report: 'Personal, Education, Job, Other',
      complete: false,
      meta: 'Personal details',
      actionLabel: 'Continue',
    };
  }

  const sections = [
    {
      label: 'Personal',
      ...scoreFields([
        profile.name,
        profile.phone,
        profile.date_of_birth,
        profile.gender,
        profile.nationality,
        profile.country_of_residence,
        profile.city,
        profile.address,
        profile.passport_number,
        profile.cnic_number,
      ]),
    },
    {
      label: 'Education',
      ...scoreFields([
        profile.education_level,
        profile.institution_name,
        profile.field_of_study,
        profile.graduation_year,
      ]),
    },
    {
      label: 'Job',
      ...scoreFields([profile.job_title, profile.employer_name, profile.years_of_experience]),
    },
    {
      label: 'Other',
      ...scoreFields([profile.other_information]),
    },
  ];

  const filled = sections.reduce((sum, section) => sum + section.filled, 0);
  const total = sections.reduce((sum, section) => sum + section.total, 0);
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100);
  const complete = sections.every((section) => section.complete);

  return {
    percent,
    complete,
    report: sections
      .map((section) =>
        section.complete ? `${section.label} ✓` : `${section.label} ${section.percent}%`,
      )
      .join(', '),
    meta: complete ? 'All sections complete' : 'Personal details',
    actionLabel: complete ? 'Review' : 'Continue',
  };
}

export function documentsSectionProgress(docs: StudentDocument[]): SectionProgress {
  const total = docs.length;
  const approved = docs.filter((doc) => doc.status === 'approved').length;
  const pending = docs.filter((doc) => doc.status === 'pending').length;
  const rejected = docs.filter((doc) => doc.status === 'rejected').length;

  if (total === 0) {
    return {
      percent: 0,
      report: 'Upload, Review, Approved',
      complete: false,
      meta: 'No files yet',
      actionLabel: 'Continue',
    };
  }

  const percent =
    rejected > 0
      ? Math.round((approved / total) * 100)
      : pending > 0
        ? Math.round(((approved + pending * 0.5) / total) * 100)
        : 100;

  const complete = approved === total && rejected === 0 && pending === 0;

  return {
    percent,
    complete,
    report: `Approved ${approved}, Pending ${pending}, Rejected ${rejected}`,
    meta: complete ? 'Documents complete' : 'Document review',
    actionLabel: complete ? 'Review' : rejected > 0 ? 'Fix uploads' : 'Continue',
  };
}

export function universitiesSectionProgress(
  universities: University[],
  docs: StudentDocument[],
): SectionProgress {
  if (universities.length === 0) {
    return {
      percent: 0,
      report: 'Waiting, Options, Required docs',
      complete: false,
      meta: 'No options yet',
      actionLabel: 'Continue',
    };
  }

  const requiredTypes = Array.from(
    new Set(
      universities.flatMap((university) =>
        (university.required_documents ?? []).map((doc) => doc.type),
      ),
    ),
  );
  const approvedTypes = new Set(
    docs.filter((doc) => doc.status === 'approved').map((doc) => doc.type),
  );
  const covered = requiredTypes.filter((type) => approvedTypes.has(type)).length;
  const requiredCount = requiredTypes.length;
  const percent = requiredCount === 0 ? 100 : Math.round((covered / requiredCount) * 100);
  const complete = requiredCount === 0 || covered >= requiredCount;

  return {
    percent,
    complete,
    report: `${universities.length} option${universities.length === 1 ? '' : 's'}, ${covered}/${Math.max(requiredCount, 1)} docs ready`,
    meta: complete ? 'Universities ready' : 'University options',
    actionLabel: complete ? 'Review' : 'Continue',
  };
}

export function feesSectionProgress(receipts: ChargeReceipt[]): SectionProgress {
  const total = receipts.length;
  const approved = receipts.filter((receipt) => receipt.status === 'approved').length;
  const review = receipts.filter((receipt) => receipt.status === 'awaiting_review').length;
  const action = receipts.filter(
    (receipt) => receipt.status === 'awaiting_student' || receipt.status === 'rejected',
  ).length;

  if (total === 0) {
    return {
      percent: 0,
      report: 'Waiting, Pay, Approved',
      complete: false,
      meta: 'No slips yet',
      actionLabel: 'Continue',
    };
  }

  const percent =
    action > 0
      ? Math.round((approved / total) * 100)
      : review > 0
        ? Math.round(((approved + review * 0.5) / total) * 100)
        : 100;
  const complete = approved === total;

  return {
    percent,
    complete,
    report: `Approved ${approved}, Review ${review}, Action ${action}`,
    meta: complete ? 'Fees complete' : 'Charge receipts',
    actionLabel: complete ? 'Review' : action > 0 ? 'Upload proof' : 'Continue',
  };
}

export function interviewSectionProgress(
  status: ApplicationStatusResponse | undefined,
): SectionProgress {
  if (!status) {
    return {
      percent: 0,
      report: 'Prep, Meeting, Follow-up',
      complete: false,
      meta: 'Interview',
      actionLabel: 'Continue',
    };
  }

  if (!status.preparation_available) {
    return {
      percent: 0,
      report: 'Locked, Prep, Meeting',
      complete: false,
      meta: 'Locked',
      actionLabel: 'Locked',
    };
  }

  const prepDone = Boolean(status.application.preparation.completed_at);
  const interview = status.application.interview;
  const meetingDone = Boolean(interview.meeting_ended_at);
  const scheduled = Boolean(interview.at);
  const declined = interview.followup_preference === 'decline_another';
  const wantsAnother = interview.followup_preference === 'want_another';
  const interviewComplete =
    interview.status === 'completed' ||
    interview.status === 'passed' ||
    interview.status === 'failed' ||
    (meetingDone && declined);

  const prepPct = prepDone ? 100 : 0;
  const meetingPct = interviewComplete || meetingDone ? 100 : scheduled ? 70 : status.interview_available ? 40 : 0;
  const followPct = interviewComplete
    ? 100
    : wantsAnother
      ? 50
      : meetingDone && !interview.followup_preference
        ? 25
        : meetingDone
          ? 75
          : 0;

  const percent = Math.round((prepPct + meetingPct + followPct) / 3);

  return {
    percent,
    complete: interviewComplete,
    report: `Prep ${prepPct}%, Meeting ${meetingPct}%, Follow-up ${followPct}%`,
    meta: interviewComplete
      ? 'Interview complete'
      : status.interview_available
        ? 'Interview open'
        : 'Preparation',
    actionLabel: interviewComplete ? 'Review' : 'Continue',
  };
}

export function visaSectionProgress(appointments: VisaAppointment[]): SectionProgress {
  const total = appointments.length;
  const scheduled = appointments.filter((item) => item.status === 'scheduled').length;
  const completed = appointments.filter((item) => item.status === 'completed').length;

  if (total === 0) {
    return {
      percent: 0,
      report: 'Waiting, Scheduled, Completed',
      complete: false,
      meta: 'No appointments yet',
      actionLabel: 'Continue',
    };
  }

  const percent =
    completed > 0 && scheduled === 0
      ? 100
      : Math.round(((completed + scheduled * 0.5) / total) * 100);
  const complete = completed > 0 && scheduled === 0;

  return {
    percent,
    complete,
    report: `Scheduled ${scheduled}, Completed ${completed}`,
    meta: complete ? 'Visa complete' : 'Visa appointments',
    actionLabel: complete ? 'Review' : 'View',
  };
}

export function statusSectionProgress(
  status: ApplicationStatusResponse | undefined,
  appointments: VisaAppointment[],
): SectionProgress {
  if (!status) {
    return {
      percent: 0,
      report: 'Docs, Fees, Interview, Visa',
      complete: false,
      meta: 'Getting started',
      actionLabel: 'Open checklist',
    };
  }

  const interview = status.application.interview;
  const interviewDone =
    interview.status === 'completed' ||
    interview.status === 'passed' ||
    interview.status === 'failed' ||
    (Boolean(interview.meeting_ended_at) &&
      interview.followup_preference === 'decline_another');

  const steps = [
    { label: 'Docs', done: status.checklist.documents.accepted },
    { label: 'Fees', done: status.checklist.charge_receipts.accepted },
    { label: 'Prep', done: Boolean(status.application.preparation.completed_at) },
    { label: 'Interview', done: interviewDone || Boolean(interview.at) },
    {
      label: 'Visa',
      done: appointments.some((item) => item.status === 'completed' || item.status === 'scheduled'),
    },
  ];

  const done = steps.filter((step) => step.done).length;
  const percent = Math.round((done / steps.length) * 100);
  const complete = done === steps.length;

  return {
    percent,
    complete,
    report: steps.map((step) => (step.done ? `${step.label} ✓` : `${step.label} pending`)).join(', '),
    meta: status.current_status,
    actionLabel: complete ? 'Review' : 'Open checklist',
  };
}
