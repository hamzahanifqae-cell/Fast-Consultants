import { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = {
  label: string;
  value: string;
  prefix?: string;
};

type SelectSheetProps = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selected?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

export function SelectSheet({
  visible,
  title,
  options,
  selected,
  searchable = false,
  searchPlaceholder = 'Search',
  onClose,
  onSelect,
}: SelectSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle) ||
        (option.prefix ?? '').toLowerCase().includes(needle),
    );
  }, [options, query]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable
          onPress={() => {
            setQuery('');
            onClose();
          }}
          style={styles.backdrop}
        />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setQuery('');
                onClose();
              }}>
              <ThemedText type="smallBold">Done</ThemedText>
            </Pressable>
          </View>

          {searchable ? (
            <TextInput
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.search,
                { backgroundColor: theme.inputFill, color: theme.text },
              ]}
              value={query}
            />
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 440 }}
            renderItem={({ item }) => {
              const isSelected = item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    onSelect(item.value);
                    setQuery('');
                    onClose();
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
                    },
                  ]}>
                  <ThemedText style={styles.optionLabel}>
                    {item.prefix ? `${item.prefix}  ` : ''}
                    {item.label}
                  </ThemedText>
                  {isSelected ? <ThemedText type="smallBold">✓</ThemedText> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                No matches.
              </ThemedText>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

type SelectFieldProps = {
  label: string;
  placeholder: string;
  valueLabel?: string | null;
  required?: boolean;
  variant?: 'pill' | 'form';
  onPress: () => void;
};

export function SelectField({
  label,
  placeholder,
  valueLabel,
  required = false,
  variant = 'pill',
  onPress,
}: SelectFieldProps) {
  const theme = useTheme();
  const form = variant === 'form';

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={form ? styles.formLabel : undefined}>
        {label}
        {required ? <ThemedText style={styles.req}> *</ThemedText> : null}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Keyboard.dismiss();
          onPress();
        }}
        style={[
          form ? styles.triggerForm : styles.trigger,
          form
            ? {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              }
            : { backgroundColor: theme.inputFill },
        ]}>
        <ThemedText
          numberOfLines={1}
          style={{ color: valueLabel ? theme.text : theme.textSecondary, flex: 1 }}>
          {valueLabel || placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.two,
  },
  search: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  formLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  req: {
    color: '#D92D20',
    textTransform: 'none',
  },
  trigger: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  triggerForm: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
