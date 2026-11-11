import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Tag } from '../types';
import { colors, spacing, radius } from '../theme';

// Toggleable workspace tags (same colored look as the web app).
export function TagChips({ tags, selectedIds, onToggle }: { tags: Tag[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  if (tags.length === 0) {
    return <Text style={styles.empty}>Aucun tag dans cet espace (créez-en depuis les paramètres de l'espace).</Text>;
  }
  return (
    <View style={styles.row}>
      {tags.map(tag => {
        const on = selectedIds.includes(tag.id);
        return (
          <Pressable
            key={tag.id}
            onPress={() => onToggle(tag.id)}
            style={[styles.chip, { borderColor: on ? tag.color : colors.border, backgroundColor: on ? `${tag.color}26` : colors.surface }]}
          >
            <View style={[styles.dot, { backgroundColor: tag.color }]} />
            <Text style={[styles.text, { color: on ? tag.color : colors.textSecondary }]}>{tag.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: spacing.lg },
});
