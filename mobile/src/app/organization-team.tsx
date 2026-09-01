import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

type Catalog = {
  roles: { value: string; label: string }[];
  staff_departments: { value: string; label: string }[];
  permissions: { value: string; label: string }[];
};

type OrgUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  staff_department?: string | null;
  staff_department_label?: string | null;
  permissions?: string[];
  is_super_admin?: boolean;
};

export default function OrganizationTeamScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const canManage = user?.is_super_admin || user?.roles.includes('super_admin');
  const canView =
    canManage ||
    user?.permissions?.includes('users.view') ||
    user?.permissions?.includes('users.manage');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [department, setDepartment] = useState('universities');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['organization-catalog'],
    enabled: Boolean(token) && Boolean(canView),
    queryFn: async () => {
      const { data } = await api.get<{ data: Catalog }>('/organization/catalog');
      return data.data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ['organization-users'],
    enabled: Boolean(token) && Boolean(canView),
    queryFn: async () => {
      const { data } = await api.get<{ data: OrgUser[] }>('/organization/users');
      return data.data;
    },
  });

  const permissionOptions = catalogQuery.data?.permissions ?? [];
  const departmentOptions = catalogQuery.data?.staff_departments ?? [];

  const selectedPermissions = useMemo(() => new Set(permissions), [permissions]);

  const createUser = useMutation({
    mutationFn: async () => {
      await api.post('/organization/users', {
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: password,
        role,
        staff_department: role === 'staff' ? department : null,
        permissions,
      });
    },
    onSuccess: async () => {
      setName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      setDepartment('universities');
      setPermissions([]);
      setError(null);
            await queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (err) => {
            setError(getApiErrorMessage(err, 'Could not create user.'));
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isOrganizationUser(user) || !canView) {
    return <Redirect href="/home" />;
  }

  function togglePermission(value: string) {
    setPermissions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function onDepartmentChange(value: string) {
    setDepartment(value);
    setPermissions(
      permissionOptions
        .filter((permission) => permission.value.startsWith(`${value}.`))
        .map((permission) => permission.value),
    );
  }

  return (
    <StudentScreen
      showBack
      title="Team & permissions">
      {usersQuery.isLoading ? <ActivityIndicator /> : null}

      {(usersQuery.data ?? []).map((member) => (
        <ThemedView
          key={member.id}
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{member.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {member.email}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {member.roles.join(', ')}
            {member.staff_department_label ? `, ${member.staff_department_label}` : ''}
          </ThemedText>
        </ThemedView>
      ))}

      {canManage ? (
        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">Add Admin or Staff</ThemedText>
          <TextInput
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            value={name}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password (min 8)"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            value={password}
          />

          <View style={styles.row}>
            <Pressable
              onPress={() => setRole('admin')}
              style={[
                styles.chip,
                { backgroundColor: role === 'admin' ? theme.successMuted : theme.inputFill },
              ]}>
              <ThemedText type="smallBold">Admin</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setRole('staff')}
              style={[
                styles.chip,
                { backgroundColor: role === 'staff' ? theme.successMuted : theme.inputFill },
              ]}>
              <ThemedText type="smallBold">Staff</ThemedText>
            </Pressable>
          </View>

          {role === 'staff' ? (
            <View style={styles.wrap}>
              {departmentOptions.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => onDepartmentChange(item.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        department === item.value ? theme.successMuted : theme.inputFill,
                    },
                  ]}>
                  <ThemedText type="smallBold">{item.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          <ThemedText type="smallBold">Permissions</ThemedText>
          {permissionOptions.map((permission) => (
            <View key={permission.value} style={styles.permissionRow}>
              <ThemedText type="small" style={styles.permissionLabel}>
                {permission.label}
              </ThemedText>
              <Switch
                value={selectedPermissions.has(permission.value)}
                onValueChange={() => togglePermission(permission.value)}
              />
            </View>
          ))}

          {error ? (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            disabled={createUser.isPending}
            onPress={() => createUser.mutate()}
            style={[styles.submit, { backgroundColor: theme.inverted }]}>
            <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
              {createUser.isPending ? 'Creating…' : 'Create user'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  permissionLabel: {
    flex: 1,
  },
  submit: {
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  error: { color: '#E24B4B' },
  success: { color: '#2F9E6B' },
});
