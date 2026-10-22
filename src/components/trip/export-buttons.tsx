import { BrandColors, Spacing } from '@/constants/theme';
import { ExportData, exportTripCsv, exportTripPdf } from '@/services/export/tripExport';
import { FileSpreadsheet, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Two buttons that hand the trip's expenses, payments and balances to the share sheet. */
export default function ExportButtons({ data }: { data: ExportData }) {
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState('');

  const run = async (kind: 'csv' | 'pdf') => {
    if (busy) return;
    setError('');
    setBusy(kind);
    try {
      await (kind === 'csv' ? exportTripCsv(data) : exportTripPdf(data));
    } catch (err) {
      console.error('Export failed:', err);
      setError('Could not export this trip. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => run('csv')} disabled={!!busy}>
          <FileSpreadsheet size={16} color={BrandColors.primary} />
          <Text style={styles.text}>{busy === 'csv' ? 'Exporting…' : 'Export CSV'}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => run('pdf')} disabled={!!busy}>
          <FileText size={16} color={BrandColors.primary} />
          <Text style={styles.text}>{busy === 'pdf' ? 'Exporting…' : 'Export PDF'}</Text>
        </Pressable>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
  },
  text: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  error: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.error },
});
