import { Redirect } from 'expo-router';

/** Preparation is now part of the Interview screen, keep this route for old links. */
export default function StudentPreparationScreen() {
  return <Redirect href="/student-interview" />;
}
