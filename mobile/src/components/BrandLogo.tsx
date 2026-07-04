import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  compact?: boolean;
};

export default function BrandLogo({ compact = false }: Props) {
  if (compact) {
    return (
      <View style={styles.compactMark}>
        <View style={styles.compactRing}>
          <Text style={styles.compactPiston}>D</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.lockup}>
      <View style={styles.mark}>
        <View style={styles.ring}>
          <Text style={styles.piston}>D</Text>
        </View>
      </View>
      <View>
        <Text style={styles.kicker}>REPUESTOS</Text>
        <View style={styles.nameRow}>
          <Text style={styles.diesel}>DIESEL</Text>
          <Text style={styles.dandy}> DANDY</Text>
        </View>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'center' },
  mark: {
    alignItems: 'center',
    backgroundColor: '#050608',
    borderColor: '#4B5563',
    borderRadius: 18,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  ring: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 23,
    borderWidth: 4,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  piston: { color: '#F8FAFC', fontSize: 25, fontWeight: '900' },
  kicker: { color: '#F8FAFC', fontSize: 12, fontWeight: '900', letterSpacing: 0 },
  nameRow: { flexDirection: 'row', marginTop: 2 },
  diesel: { color: colors.primary, fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  dandy: { color: '#F8FAFC', fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  rule: { backgroundColor: colors.primary, borderRadius: 2, height: 3, marginTop: 4, width: 148 },
  compactMark: {
    alignItems: 'center',
    backgroundColor: '#050608',
    borderColor: '#4B5563',
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  compactRing: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 3,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  compactPiston: { color: '#F8FAFC', fontSize: 17, fontWeight: '900' },
});
