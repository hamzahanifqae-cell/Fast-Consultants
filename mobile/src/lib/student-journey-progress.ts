import { isInterviewMeetingCancelled } from '@/lib/interview';
import type {
  ApplicationStatusResponse,
  StudentProfile,
  VisaAppointment,
} from '@/types/auth';

export type StudentJourneyStep = {
  id: string;
  label: string;
  done: boolean;
  color: string;
};

export type StudentCurrentStep = {
  title: string;
  body: string;
  href: string;
  label: string;
  done?: boolean;
};

function isCategoryComplete(profile: StudentProfile) {
  return Boolean(
    profile.education_level &&
      profile.institution_name &&
      profile.field_of_study &&
      profile.graduation_year &&
      profile.job_title &&
      profile.employer_name &&
      profile.years_of_experience &&
      profile.other_information,
  );
}

export function isProfileComplete(profile: StudentProfile | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.phone &&
      profile.date_of_birth &&
      profile.gender &&
      profile.nationality &&
      profile.country_of_residence &&
      profile.city &&
      profile.address &&
      profile.passport_number &&
      profile.cnic_number &&
      profile.information_category &&
      isCategoryComplete(profile),
  );
}

export function isInterviewJourneyComplete(
  interview: ApplicationStatusResponse['application']['interview'] | undefined,
): boolean {
  if (!interview) return false;
  if (
    interview.status === 'completed' ||
    interview.status === 'passed' ||
    interview.status === 'failed'
  ) {
    return true;
  }
  return (
    Boolean(interview.meeting_ended_at) && interview.followup_preference === 'decline_another'
  );
}

export function isVisaJourneyComplete(appointments: VisaAppointment[]) {
  return appointments.some((appointment) => appointment.status === 'completed');
}

export type StatusJourneyState = 'complete' | 'current' | 'upcoming' | 'locked';

export type StatusJourneyStep = {
  id: string;
  label: string;
  detail: string;
  state: StatusJourneyState;
  href?: string;
  actionLabel?: string;
};

export function statusJourneyStateLabel(state: StatusJourneyState) {
  if (state === 'complete') return 'Complete';
  if (state === 'current') return 'In progress';
  if (state === 'locked') return 'Locked';
  return 'Up next';
}

function formatStatusWhen(value: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function overallStatusSummary(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
) {
  if (!status) {
    return {
      percent: 0,
      title: 'Loading your application',
      description: 'Fetching your latest checklist and stage details.',
    };
  }

  const profileDone = isProfileComplete(profile);
  const steps = [
    profileDone,
    Boolean(status.checklist.documents.accepted),
    Boolean(status.checklist.charge_receipts.accepted),
    Boolean(status.application.preparation.completed_at),
    isInterviewJourneyComplete(status.application.interview),
    isVisaJourneyComplete(appointments),
  ];
  const done = steps.filter(Boolean).length;
  const percent = Math.round((done / steps.length) * 100);
  const currentFocus = profileDone ? status.current_status : 'Student info';

  if (percent >= 100) {
    return {
      percent: 100,
      title: 'Application complete',
      description: 'Personal info, documents, fees, interview, and visa are all finished.',
    };
  }

  if (steps[4] && !steps[5]) {
    return {
      percent,
      title: 'Visa stage in progress',
      description: appointments.some((a) => a.status === 'scheduled')
        ? 'Your interview is done. Attend your scheduled visa appointment next.'
        : 'Interview complete. Visa staff will schedule your embassy appointment.',
    };
  }

  return {
    percent,
    title: 'Application in progress',
    description: `${done} of ${steps.length} stages complete · Current focus: ${currentFocus}`,
  };
}

export function buildStatusJourneySteps(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
): StatusJourneyStep[] {
  if (!status) return [];

  const profileDone = isProfileComplete(profile);
  const docsDone = Boolean(status.checklist.documents.accepted);
  const feesDone = Boolean(status.checklist.charge_receipts.accepted);
  const prepDone = Boolean(status.application.preparation.completed_at);
  const interviewDone = isInterviewJourneyComplete(status.application.interview);
  const visaDone = isVisaJourneyComplete(appointments);

  const flags = [profileDone, docsDone, feesDone, prepDone, interviewDone, visaDone];
  const firstOpen = flags.findIndex((done) => !done);

  function stateFor(index: number): StatusJourneyState {
    if (flags[index]) return 'complete';
    if (firstOpen === -1) return 'complete';
    if (index === firstOpen) return 'current';
    return 'locked';
  }

  const docs = status.checklist.documents;
  const fees = status.checklist.charge_receipts;
  const interview = status.application.interview;

  return [
    {
      id: 'profile',
      label: 'Student info',
      detail: profileDone
        ? 'Personal details submitted'
        : 'Add phone, nationality, passport, CNIC, and other details',
      state: stateFor(0),
      href: '/student-personal-information',
      actionLabel: profileDone ? 'View' : 'Open',
    },
    {
      id: 'documents',
      label: 'Documents',
      detail: !profileDone
        ? 'Complete student info first'
        : docsDone
          ? 'All required files approved'
          : `${docs.approved} approved · ${docs.pending} pending review`,
      state: !profileDone ? 'locked' : stateFor(1),
      href: '/student-documents',
      actionLabel: docsDone ? 'View' : 'Open',
    },
    {
      id: 'fees',
      label: 'Charge receipts',
      detail: !profileDone
        ? 'Complete student info first'
        : feesDone
          ? 'All fee slips cleared'
          : `${fees.approved} approved · ${fees.pending} awaiting action`,
      state: !profileDone ? 'locked' : stateFor(2),
      href: '/student-charge-receipts',
      actionLabel: feesDone ? 'View' : 'Open',
    },
    {
      id: 'preparation',
      label: 'Interview preparation',
      detail: !profileDone
        ? 'Complete student info first'
        : !status.preparation_available
          ? 'Unlocks after documents and fees are approved'
          : prepDone
            ? 'Preparation checklist completed'
            : 'Preparation notes are ready for you',
      state: !profileDone || !status.preparation_available
        ? 'locked'
        : prepDone
          ? 'complete'
          : stateFor(3),
      href: status.preparation_available ? '/student-interview' : undefined,
      actionLabel: prepDone ? 'View' : 'Open',
    },
    {
      id: 'interview',
      label: 'Interview meeting',
      detail: !profileDone
        ? 'Complete student info first'
        : !status.interview_available
          ? 'Scheduled after preparation is complete'
          : isInterviewMeetingCancelled(interview)
            ? 'Meeting cancelled — staff will reschedule'
            : interview.at
              ? `Scheduled ${formatStatusWhen(interview.at)}`
              : interview.status_label ?? 'Interview stage active',
      state: !profileDone || !status.interview_available
        ? 'locked'
        : interviewDone
          ? 'complete'
          : stateFor(4),
      href: status.interview_available ? '/student-interview' : undefined,
      actionLabel: 'Open',
    },
    {
      id: 'visa',
      label: 'Visa appointment',
      detail: !profileDone
        ? 'Complete student info first'
        : visaDone
          ? 'Embassy appointment completed'
          : appointments.some((a) => a.status === 'scheduled')
            ? 'Appointment scheduled — see details below'
            : 'Visa staff will book after interview',
      state: !profileDone ? 'locked' : stateFor(5),
      href: '/student-visa-appointments',
      actionLabel: appointments.length ? 'View' : undefined,
    },
  ];
}

export function studentProgressSteps(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
): StudentJourneyStep[] {
  return [
    {
      id: 'profile',
      label: 'Profile',
      done: isProfileComplete(profile),
      color: '#22d3ee',
    },
    {
      id: 'documents',
      label: 'Documents',
      done: Boolean(status?.checklist.documents.accepted),
      color: '#60a5fa',
    },
    {
      id: 'fees',
      label: 'Fees',
      done: Boolean(status?.checklist.charge_receipts.accepted),
      color: '#fbbf24',
    },
    {
      id: 'preparation',
      label: 'Prep',
      done: Boolean(status?.application.preparation.completed_at),
      color: '#c084fc',
    },
    {
      id: 'interview',
      label: 'Interview',
      done: isInterviewJourneyComplete(status?.application.interview),
      color: '#34d399',
    },
    {
      id: 'visa',
      label: 'Visa',
      done: isVisaJourneyComplete(appointments),
      color: '#a78bfa',
    },
  ];
}

export function studentProgressPercent(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
) {
  const steps = studentProgressSteps(status, profile, appointments);
  const done = steps.filter((step) => step.done).length;
  return Math.round((done / steps.length) * 100);
}

export function currentStudentStep(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
): StudentCurrentStep {
  if (!isProfileComplete(profile)) {
    return {
      title: 'Complete your personal details',
      body: 'Add phone, nationality, residence, passport, and CNIC so staff can support your application.',
      href: '/student-personal-information',
      label: 'Open personal info',
    };
  }

  if (!status) {
    return {
      title: 'Upload your admission documents',
      body: 'Passport, academic records, and English test scores unlock the next stages.',
      href: '/student-documents',
      label: 'Go to documents',
    };
  }

  const docs = status.checklist.documents;
  if (!docs.accepted) {
    if (docs.total === 0) {
      return {
        title: 'Upload your admission documents',
        body: 'Passport, academic records, and English test scores unlock the next stages.',
        href: '/student-documents',
        label: 'Go to documents',
      };
    }
    if (docs.rejected > 0) {
      return {
        title: 'Fix rejected documents',
        body: 'One or more files need a clearer upload. Review the rejection notes and send again.',
        href: '/student-documents',
        label: 'Review documents',
      };
    }
    return {
      title: 'Documents under review',
      body: 'Staff are checking your uploads. This step stays active until every file is approved.',
      href: '/student-documents',
      label: 'View documents',
    };
  }

  const fees = status.checklist.charge_receipts;
  if (!fees.accepted) {
    if (fees.total === 0) {
      return {
        title: 'Waiting for fee slips',
        body: 'Finance will send charge slips here. This is your current step until fees are cleared.',
        href: '/student-charge-receipts',
        label: 'View receipts',
      };
    }
    if (fees.rejected > 0) {
      return {
        title: 'Fix rejected payment proof',
        body: 'Upload a clearer payment screenshot so Finance can approve your slip.',
        href: '/student-charge-receipts',
        label: 'Open receipts',
      };
    }
    return {
      title: 'Complete your fee payments',
      body: 'Pay any open slips and upload proof. This step finishes when Finance approves them.',
      href: '/student-charge-receipts',
      label: 'View receipts',
    };
  }

  if (!status.preparation_available) {
    return {
      title: 'Waiting for preparation unlock',
      body: 'Documents and fees are done. Staff will unlock interview preparation next.',
      href: '/student-interview',
      label: 'Open interview',
    };
  }

  if (!status.application.preparation.completed_at) {
    return {
      title: 'Complete interview preparation',
      body: 'Preparation is unlocked. Open Interview to finish the checklist before your meeting.',
      href: '/student-interview',
      label: 'Open interview',
    };
  }

  if (!status.interview_available) {
    return {
      title: 'Waiting for interview scheduling',
      body: 'Preparation is complete. Interview details will appear when staff unlock them.',
      href: '/student-interview',
      label: 'Open interview',
    };
  }

  const interview = status.application.interview;

  if (!isInterviewJourneyComplete(interview)) {
    if (isInterviewMeetingCancelled(interview)) {
      return {
        title: 'Interview meeting cancelled',
        body: 'Preparation staff cancelled the session. You will be notified when a new time is scheduled.',
        href: '/student-interview',
        label: 'Open interview',
      };
    }

    if (interview.at) {
      return {
        title: 'Attend your interview',
        body: 'Your meeting is scheduled. Open Interview for timing, the timer, and join details.',
        href: '/student-interview',
        label: 'Open interview',
      };
    }

    if (interview.meeting_ended_at) {
      if (interview.followup_preference === 'want_another') {
        return {
          title: 'Waiting for next interview',
          body: 'You asked for another meeting. Staff will schedule the next session.',
          href: '/student-interview',
          label: 'Open interview',
        };
      }

      return {
        title: 'Confirm your interview follow-up',
        body: 'Your last session has ended. Tell staff whether you want another meeting.',
        href: '/student-interview',
        label: 'Open interview',
      };
    }

    return {
      title: 'Track your interview',
      body: 'Interview is available. Check timing and updates, and message your team if needed.',
      href: '/student-status',
      label: 'View status',
    };
  }

  if (!isVisaJourneyComplete(appointments)) {
    const scheduled = appointments.filter((item) => item.status === 'scheduled');
    if (scheduled.length > 0) {
      return {
        title: 'Attend your visa appointment',
        body: 'Visa staff shared your embassy appointment. Check the details and prepare for the visit.',
        href: '/student-visa-appointments',
        label: 'Open visa appointments',
      };
    }

    return {
      title: 'Waiting for visa appointment',
      body: 'Interview is finished. Visa staff will schedule your embassy appointment next.',
      href: '/student-visa-appointments',
      label: 'Open visa appointments',
    };
  }

  return {
    title: 'All current steps complete',
    body: 'Interview and visa appointment are done. Message your consultant anytime if you need support.',
    href: '/student-status',
    label: 'View status',
    done: true,
  };
}
