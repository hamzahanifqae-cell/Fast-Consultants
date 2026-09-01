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

function isInterviewJourneyComplete(
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

function isVisaJourneyComplete(appointments: VisaAppointment[]) {
  return appointments.some((appointment) => appointment.status === 'completed');
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
