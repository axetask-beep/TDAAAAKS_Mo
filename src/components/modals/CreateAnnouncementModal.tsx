import React, { useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../../lib/api';
import { FormModal } from '../FormModal';
import { Button, TextField } from '../ui';

export default function CreateAnnouncementModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setContent('');
  };

  const onSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await api.createAnnouncement(title.trim(), content.trim());
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Impossible de publier l'annonce.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={visible} onClose={onClose} title="Rédiger une annonce">
      <TextField
        label="Titre"
        value={title}
        onChangeText={setTitle}
        placeholder="Ex : Nouvelle politique de congés..."
        autoFocus
      />
      <TextField
        label="Message"
        value={content}
        onChangeText={setContent}
        placeholder="Détaillez votre annonce pour toute l'équipe..."
        multiline
        numberOfLines={5}
      />
      <Button title="Publier pour tous" onPress={onSubmit} loading={submitting} fullWidth />
    </FormModal>
  );
}
