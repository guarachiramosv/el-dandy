import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  imageUrl: string | null;
  onClose: () => void;
};

export default function ImageViewer({ imageUrl, onClose }: Props) {
  return (
    <Modal animationType="fade" transparent visible={!!imageUrl} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
        {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  closeButton: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    right: 16,
    top: 52,
    zIndex: 2,
  },
  closeText: { color: colors.text, fontWeight: '900' },
  image: { height: '86%', width: '100%' },
});
