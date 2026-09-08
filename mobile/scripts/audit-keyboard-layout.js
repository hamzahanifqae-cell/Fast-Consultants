#!/usr/bin/env node
/**
 * Smoke audit: auth keyboard layout must not recreate the white-gap / buried-CTA bug.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function mustInclude(rel, needle, why) {
  if (!read(rel).includes(needle)) failures.push(`${rel}: missing ${JSON.stringify(needle)} — ${why}`);
}

function mustNotInclude(rel, needle, why) {
  if (read(rel).includes(needle)) failures.push(`${rel}: must not contain ${JSON.stringify(needle)} — ${why}`);
}

mustInclude(
  'android/app/src/main/AndroidManifest.xml',
  'windowSoftInputMode="adjustNothing"',
  'JS lifts the sheet; OS must not resize/fight layout',
);
mustNotInclude(
  'android/app/src/main/AndroidManifest.xml',
  'adjustResize',
  'adjustResize failed on device and left CTA under keyboard',
);

for (const screen of ['src/app/login.tsx', 'src/app/register.tsx']) {
  mustInclude(screen, 'paddingBottom: keyboardVisible ? keyboardInset : 0', 'Body must lift by keyboard height');
  mustInclude(screen, 'gap: 8', 'Tight 8px rhythm between password and CTA');
  mustNotInclude(screen, 'sheetKeyboard', 'flex-expand sheet creates the white gap');
  mustNotInclude(screen, 'styles.ctaDock', 'Separate dock + flex spacer buries the CTA');
  mustNotInclude(screen, 'bodyLift', 'Do not skip Android keyboard lift');
  mustNotInclude(screen, "Platform.OS === 'ios' ? keyboardInset : 0", 'Android must also lift');
}

mustInclude(
  'src/hooks/use-keyboard-bottom-inset.ts',
  "Dimensions.get('screen').height",
  'Measure from screen so Samsung IME height is accurate',
);

mustInclude('src/components/chat-panel.tsx', 'bottom: bottomPad', 'Chat footer clears nav bar');
mustInclude('src/components/student/select-sheet.tsx', 'marginBottom: sheetLift', 'City/country search lifts');
mustInclude('android/gradle.properties', 'edgeToEdgeEnabled=false', 'Nav insets reliable in APK');

if (failures.length) {
  console.error('SMOKE AUDIT FAILED:\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log('SMOKE AUDIT PASSED');
process.exit(0);
