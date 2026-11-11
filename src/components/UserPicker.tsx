// Searchable assignee picker. Replaces the long horizontal chip row, which
// got tedious to scroll once a team has more than a handful of people.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../types';
import { colors, spacing, radius } from '../theme';
import { FormModal } from './FormModal';
import { Avatar } from './ui';

export function UserPickerField({
  label,
  users,
  value,
  onChange,
}: {
  label?: string;
  users: User[];
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = users.find(u => u.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        {selected ? <Avatar user={selected} size={28} /> : (
          <View style={styles.emptyAvatar}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.flex1}>
          {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          <Text style={[styles.fieldValue, !selected && { color: colors.textMuted }]} numberOfLines={1}>
            {selected ? selected.name : 'Personne — touchez pour choisir'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <FormModal visible={open} onClose={() => setOpen(false)} title="Assigner à">
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un membre…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </View>
        <FlatList
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          data={[null, ...filtered]}
          keyExtractor={u => u?.id || 'none'}
          renderItem={({ item }) => {
            const active = (item?.id || null) === (value || null);
            return (
              <Pressable style={[styles.row, active && styles.rowActive]} onPress={() => pick(item?.id || null)}>
                {item ? <Avatar user={item} size={32} /> : (
                  <View style={[styles.emptyAvatar, { width: 32, height: 32 }]}>
                    <Ionicons name="person-remove-outline" size={15} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.flex1}>
                  <Text style={styles.rowName}>{item ? item.name : 'Personne'}</Text>
                  {item?.email ? <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text> : null}
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.primarySoft} />}
              </Pressable>
            );
          }}
        />
      </FormModal>
    </>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 1 },
  emptyAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 10 },
  list: { maxHeight: 420 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  rowActive: { backgroundColor: `${colors.primary}1F` },
  rowName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowEmail: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
});
