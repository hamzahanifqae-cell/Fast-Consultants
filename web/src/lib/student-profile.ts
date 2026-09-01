import type { StudentProfile } from '@/types/auth';

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
