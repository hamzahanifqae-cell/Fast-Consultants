import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { PageSplit, PageTips } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentProfile } from '@/types/auth';
import './dashboard.css';

const PROFILE_FIELD_COUNT = 19;

function profileFilledCount(profile: StudentProfile) {
  return [
    profile.name,
    profile.email,
    profile.phone,
    profile.date_of_birth,
    profile.gender,
    profile.nationality,
    profile.country_of_residence,
    profile.city,
    profile.address,
    profile.passport_number,
    profile.cnic_number,
    profile.education_level,
    profile.institution_name,
    profile.field_of_study,
    profile.graduation_year,
    profile.job_title,
    profile.employer_name,
    profile.years_of_experience,
    profile.other_information,
  ].filter((value) => Boolean(value?.trim())).length;
}

export function ConsultantStudentDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);

  const detailQuery = useQuery({
    queryKey: ['consultant-student', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<{ data: { profile: StudentProfile } }>(
        `/consultant/students/${id}`,
      );
      return data.data;
    },
  });

  const profile = detailQuery.data?.profile;
  const filled = profile ? profileFilledCount(profile) : 0;
  const totalFields = PROFILE_FIELD_COUNT;
  const complete = filled >= totalFields;
  const progressPct = Math.round((filled / totalFields) * 100);

  return (
    <AppShell
      badge="Student Info"
      title={profile?.name ?? 'Student'}
      subtitle={profile?.email ?? undefined}
      backTo={routes.studentInfo.students}
      backLabel="All students">
      <div className="page-stack">
        {id ? (
          <p>
            <Link to={`${routes.documents.root}?student=${id}`}>Open Documents</Link>
          </p>
        ) : null}

        <div className="profile-progress panel">
          <div className="profile-progress-copy">
            <strong>
              {detailQuery.isLoading
                ? 'Loading profile…'
                : complete
                  ? 'Profile complete'
                  : 'Profile incomplete'}
            </strong>
            <span>
              {detailQuery.isLoading
                ? 'Fetching student details'
                : complete
                  ? 'All required personal details are on file.'
                  : `${filled} of ${totalFields} required fields filled, ask the student to complete their profile.`}
            </span>
          </div>
          <div className="profile-progress-meter" aria-hidden={detailQuery.isLoading}>
            <div className="profile-progress-track">
              <div
                className={`profile-progress-fill${complete ? ' is-complete' : ''}`}
                style={{
                  width: detailQuery.isLoading ? '0%' : `${progressPct}%`,
                  ['--progress' as string]: Math.max(progressPct, 1),
                }}
              />
            </div>
            <span className="profile-progress-pct">
              {detailQuery.isLoading ? '…' : `${progressPct}%`}
            </span>
          </div>
        </div>

        <PageSplit
          main={
            <div className="panel">
              <h2>Student profile</h2>
              {detailQuery.isLoading ? <p className="muted">Loading…</p> : null}
              {profile ? (
                <div className="stack-list">
                  <ProfileSection title="Personal">
                    <Row label="Full name" value={profile.name} />
                    <Row label="Email" value={profile.email} />
                    <Row label="Phone" value={profile.phone} />
                    <Row label="Date of birth" value={profile.date_of_birth} />
                    <Row label="Gender" value={profile.gender} />
                    <Row label="Nationality" value={profile.nationality} />
                    <Row label="Country" value={profile.country_of_residence} />
                    <Row label="City" value={profile.city} />
                    <Row label="Address" value={profile.address} />
                    <Row label="Passport" value={profile.passport_number} />
                    <Row label="CNIC" value={profile.cnic_number} />
                  </ProfileSection>

                  <ProfileSection title="Education">
                    <Row label="Education level" value={profile.education_level} />
                    <Row label="Institution" value={profile.institution_name} />
                    <Row label="Field of study" value={profile.field_of_study} />
                    <Row label="Graduation year" value={profile.graduation_year} />
                  </ProfileSection>

                  <ProfileSection title="Job">
                    <Row label="Job title" value={profile.job_title} />
                    <Row label="Employer" value={profile.employer_name} />
                    <Row label="Experience" value={profile.years_of_experience} />
                  </ProfileSection>

                  <ProfileSection title="Other">
                    <Row label="Other information" value={profile.other_information} />
                  </ProfileSection>
                </div>
              ) : null}
            </div>
          }
          side={
            <>
              <PageTips
                title="Using this profile"
                items={[
                  'Confirm passport and contact before advising documents.',
                  'Review education or job background before recommending programs.',
                  'Students can edit these details in the student portal or mobile app.',
                ]}
              />
            </>
          }
        />
      </div>
    </AppShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="profile-detail-section">
      <h3>{title}</h3>
      <div className="profile-detail-section-rows">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="stack-item">
      <div>
        <strong>{label}</strong>
        <span>{value || 'None'}</span>
      </div>
    </div>
  );
}
