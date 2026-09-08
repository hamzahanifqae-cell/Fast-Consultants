import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { compareSearchMatch, optionMatchesQuery } from '@/lib/option-search';

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
  const bottomPad = useBottomSafeInset(Spacing.three);
  const keyboardInset = useKeyboardBottomInset();
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim();
    if (!needle) return options;
    return options
      .filter((option) => optionMatchesQuery(option, needle))
      .sort((a, b) => compareSearchMatch(a, b, needle));
  }, [options, query]);

  // adjustNothing: lift Modal sheet; clamp so it never jams into the status bar.
  const sheetLift = keyboardInset > 40 ? Math.min(keyboardInset, Math.floor(windowHeight * 0.48)) : 0;
  const listMaxHeight = Math.max(120, Math.min(300, (windowHeight - sheetLift) * 0.38));

  function close() {
    setQuery('');
    Keyboard.dismiss();
    onClose();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={close} style={styles.backdrop} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: sheetLift > 0 ? Spacing.two : bottomPad,
              marginBottom: sheetLift,
            },
          ]}>
          <View style={styles.header}>
            <ThemedText type="smallBold">{title}</ThemedText>
            <Pressable hitSlop={8} onPress={close}>
              <ThemedText type="smallBold">Done</ThemedText>
            </Pressable>
          </View>

          {searchable ? (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              clearButtonMode="while-editing"
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
            keyboardDismissMode="on-drag"
            style={{ maxHeight: listMaxHeight }}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    zIndex: 2,
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
