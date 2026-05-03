import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import pako from 'pako';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { brailleService } from '../../services';
import { printBrailleText } from '../../store/slices/deviceSlice';
import { RootState, AppDispatch } from '../../store';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BrailleConvert'>;
};

const C = {
  bg:       '#0A0A0F',
  card:     '#1E293B',
  cardDark: '#0F172A',
  blue:     '#3B82F6',
  blueDark: '#2563EB',
  green:    '#10B981',
  greenDk:  '#059669',
  purple:   '#8B5CF6',
  purpleDk: '#7C3AED',
  orange:   '#F59E0B',
  white:    '#FFFFFF',
  dim:      'rgba(255,255,255,0.55)',
  border:   'rgba(255,255,255,0.12)',
};

// ── Local PDF text extractor (no internet, no AI) ─────────────────────────────
// Implements zlib stream decompression (FlateDecode) via pako and parses
// PDF content streams for Tj / TJ text operators — same approach as liblouis
// companion tools. Works on all standard digital PDFs. Scanned / image-only
// PDFs have no text layer and cannot be extracted by any local library.

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToString(bytes: Uint8Array): string {
  // Process in chunks to avoid stack overflow on large files
  const CHUNK = 8192;
  let str = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return str;
}

function decodePDFLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function decodePDFHexString(hex: string): string {
  const h = hex.replace(/\s/g, '');
  let out = '';
  // If length is a multiple of 4, treat as UTF-16BE (CID font), else Latin-1
  if (h.length % 4 === 0 && h.length > 0) {
    for (let i = 0; i < h.length; i += 4) {
      const code = parseInt(h.slice(i, i + 4), 16);
      if (code > 0) out += String.fromCharCode(code);
    }
  } else {
    for (let i = 0; i < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (!isNaN(byte)) out += String.fromCharCode(byte);
    }
  }
  return out;
}

function extractTextFromContentStream(stream: string): string {
  const parts: string[] = [];
  // Match everything inside BT … ET blocks
  const btEt = /BT([\s\S]*?)ET/g;
  let bm: RegExpExecArray | null;
  while ((bm = btEt.exec(stream)) !== null) {
    const block = bm[1];
    // Match literal strings: (…) Tj   or   (…) '
    const litTj = /\(([^)]*)\)\s*['Tj]/g;
    let m: RegExpExecArray | null;
    while ((m = litTj.exec(block)) !== null) {
      const s = decodePDFLiteralString(m[1]);
      if (s.trim()) parts.push(s);
    }
    // Match hex strings: <…> Tj
    const hexTj = /<([0-9A-Fa-f\s]*)>\s*Tj/g;
    while ((m = hexTj.exec(block)) !== null) {
      const s = decodePDFHexString(m[1]);
      if (s.trim()) parts.push(s);
    }
    // Match TJ arrays: [ (…) num (…) … ] TJ
    const tjArr = /\[([^\]]*)\]\s*TJ/g;
    while ((m = tjArr.exec(block)) !== null) {
      const inner = m[1];
      // Literal strings inside the array
      const litInner = /\(([^)]*)\)/g;
      let lm: RegExpExecArray | null;
      while ((lm = litInner.exec(inner)) !== null) {
        const s = decodePDFLiteralString(lm[1]);
        if (s.trim()) parts.push(s);
      }
      // Hex strings inside the array
      const hexInner = /<([0-9A-Fa-f\s]*)>/g;
      while ((lm = hexInner.exec(inner)) !== null) {
        const s = decodePDFHexString(lm[1]);
        if (s.trim()) parts.push(s);
      }
    }
    // Td / TD / T* → word boundary (new line / next text position)
    if (/\bT[dD*]\b/.test(block)) parts.push(' ');
  }
  return parts.join('');
}

async function extractTextFromPDF(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const pdfBytes = base64ToUint8Array(b64);

  // Verify PDF magic number %PDF-
  if (pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50 || pdfBytes[2] !== 0x44 || pdfBytes[3] !== 0x46) {
    throw new Error('Not a valid PDF file.');
  }

  const pdfStr = uint8ToString(pdfBytes);
  const textBlocks: string[] = [];
  let pos = 0;

  while (pos < pdfStr.length) {
    const streamIdx = pdfStr.indexOf('stream', pos);
    if (streamIdx === -1) break;

    // Find start of binary content (after \n or \r\n)
    let contentStart = streamIdx + 6;
    if (pdfStr[contentStart] === '\r') contentStart++;
    if (pdfStr[contentStart] === '\n') contentStart++;

    const endIdx = pdfStr.indexOf('endstream', contentStart);
    if (endIdx === -1) break;

    // Inspect the object dictionary for filter and length
    const dictStart = pdfStr.lastIndexOf('<<', streamIdx);
    const dictStr = dictStart >= 0 ? pdfStr.slice(dictStart, streamIdx) : '';

    let streamBytes = pdfBytes.slice(contentStart, endIdx);

    // Decompress FlateDecode (zlib / deflate) — used by most modern PDFs
    if (/\/FlateDecode|\/Fl\b/.test(dictStr)) {
      try {
        streamBytes = pako.inflate(streamBytes);
      } catch {
        pos = endIdx + 9;
        continue;
      }
    } else if (/\/ASCII85Decode|\/LZWDecode|\/RunLengthDecode/.test(dictStr)) {
      // Skip encodings we don't handle — not typically used for text streams
      pos = endIdx + 9;
      continue;
    }

    // Skip image streams (XObject with Subtype /Image)
    if (/\/Subtype\s*\/Image/.test(dictStr)) {
      pos = endIdx + 9;
      continue;
    }

    const content = uint8ToString(streamBytes);
    if (content.includes('BT') && content.includes('ET')) {
      const text = extractTextFromContentStream(content);
      if (text.trim()) textBlocks.push(text);
    }

    pos = endIdx + 9;
  }

  if (textBlocks.length === 0) {
    throw new Error(
      'No text found in this PDF.\n\n' +
      'This is likely a scanned (image-only) PDF. ' +
      'Local extraction only works on digital PDFs with text layers. ' +
      'Please type or paste the text manually.',
    );
  }

  return textBlocks.join('\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// ── Document text extraction ─────────────────────────────────────────────────

async function extractTextFromFile(
  uri: string,
  mimeType: string,
  name: string,
): Promise<string> {
  const ext = (name.split('.').pop() ?? '').toLowerCase();

  // Plain text — perfect accuracy, offline
  if (ext === 'txt' || mimeType === 'text/plain') {
    const res = await fetch(uri);
    return res.text();
  }

  // Word document — mammoth.js, offline, perfect accuracy
  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const res = await fetch(uri);
    const arrayBuffer = await res.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value as string;
  }

  // PDF — local parser (no AI, no internet), works for digital PDFs
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractTextFromPDF(uri);
  }

  // Old .doc — suggest converting
  if (ext === 'doc') {
    throw new Error(
      'Old .doc format is not supported.\nPlease open in Word / Google Docs and save as .docx, then upload again.',
    );
  }

  // Images — no local OCR available in React Native
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) || mimeType.startsWith('image/')) {
    throw new Error(
      'Image files cannot be converted without OCR.\nPlease type or paste the text from the image into the text box below.',
    );
  }

  throw new Error(
    `Unsupported file type: .${ext}\nSupported formats: .txt  .docx  .pdf (digital only)`,
  );
}

// ── Braille-only PDF ──────────────────────────────────────────────────────────
//
// Standard Grade 1 braille print spec:
//   • Dot diameter : 1.5 mm → ~4.25 pt
//   • Cell width   : 6 mm   → ~17 pt
//   • Cell height  : 10 mm  → ~28 pt
//   • Inter-cell gap: 3.5 mm → included in character spacing
//
// We render the Unicode braille characters at 28 pt with letter-spacing of 6 pt
// and line-height of 1.8 to achieve approximately correct proportions on paper.
// Margins: 25 mm (≈71 pt) on all sides so nothing is clipped.

function buildBraillePdf(brailleText: string, sourceInfo: string): string {
  const safe = brailleText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split into paragraphs (preserve newlines)
  const paragraphs = safe.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page {
    size: A4;
    margin: 25mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
  }
  header {
    border-bottom: 1px solid #ccc;
    padding-bottom: 6pt;
    margin-bottom: 18pt;
  }
  header h1 {
    font-size: 11pt;
    font-weight: bold;
    margin: 0 0 2pt 0;
    color: #1D4ED8;
  }
  header p {
    font-size: 8pt;
    color: #6B7280;
    margin: 0;
  }
  .braille-body p {
    /* 28pt matches ~10 mm cell height; letter-spacing 5pt ≈ inter-cell gap */
    font-size: 28pt;
    line-height: 1.75;
    letter-spacing: 5pt;
    margin: 0 0 4pt 0;
    word-break: break-all;
    /* Prevent characters spilling past the right margin */
    overflow-wrap: anywhere;
  }
  footer {
    position: fixed;
    bottom: 10mm;
    left: 25mm;
    right: 25mm;
    font-size: 7pt;
    color: #9CA3AF;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 4pt;
  }
</style>
</head>
<body>
<header>
  <h1>Braille Document — Grade 1</h1>
  <p>${sourceInfo} • Generated by BrailleTutor App • ${new Date().toLocaleDateString()}</p>
</header>

<div class="braille-body">
${paragraphs}
</div>

<footer>Grade 1 Braille (Unicode) • BrailleTutor © ${new Date().getFullYear()}</footer>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BrailleConvertScreen: React.FC<Props> = ({ navigation }) => {
  const safeInsets  = useSafeAreaInsets();
  const appDispatch = useDispatch<AppDispatch>();
  const deviceConnected = useSelector((s: RootState) => (s as any).device?.connected ?? false);

  const [inputText, setInputText]         = useState('');
  const [brailleOutput, setBrailleOutput] = useState('');
  const [brailleCells, setBrailleCells]   = useState<any[]>([]);
  const [converting, setConverting]       = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [printing, setPrinting]           = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [fileName, setFileName]           = useState<string | null>(null);
  const [uploadStatus, setUploadStatus]   = useState('');

  const scrollRef = useRef<ScrollView>(null);

  // ── Convert ─────────────────────────────────────────────────────────────────

  const handleConvert = useCallback(() => {
    if (!inputText.trim()) {
      Alert.alert('No Text', 'Please enter or upload text to convert.');
      return;
    }
    setConverting(true);
    try {
      const result = brailleService.textToBraille(inputText);
      setBrailleOutput(result.brailleUnicode);
      setBrailleCells(result.cells);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } finally {
      setConverting(false);
    }
  }, [inputText]);

  // ── Upload document ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    setUploading(true);
    setUploadStatus('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',          // accept everything — we detect type ourselves
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';

      setUploadStatus(`Reading ${file.name ?? 'file'}…`);

      if (ext === 'pdf') {
        setUploadStatus('Parsing PDF locally… (no internet needed)');
      }

      const text = await extractTextFromFile(
        file.uri,
        file.mimeType ?? '',
        file.name ?? '',
      );

      if (!text.trim()) {
        Alert.alert('No Text Found', 'The document appears to be empty or could not be read.');
        return;
      }

      setInputText(text);
      setFileName(file.name ?? 'document');
      setBrailleOutput('');
      setBrailleCells([]);
      setUploadStatus(`✓ ${text.length.toLocaleString()} characters extracted`);
    } catch (err) {
      Alert.alert('Upload Failed', (err as Error).message);
      setUploadStatus('');
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Print via BLE ────────────────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    if (!brailleOutput) { Alert.alert('Nothing to Print', 'Convert text first.'); return; }
    if (!deviceConnected) { Alert.alert('No Device', 'Connect a Braille device first.'); return; }
    setPrinting(true);
    try {
      await appDispatch(printBrailleText(inputText));
      Alert.alert('Print Started', 'Printing to Braille device…');
    } catch (err) {
      Alert.alert('Print Failed', (err as Error).message);
    } finally {
      setPrinting(false);
    }
  }, [brailleOutput, inputText, deviceConnected, appDispatch]);

  // ── Export PDF ───────────────────────────────────────────────────────────────

  const handleExportPDF = useCallback(async () => {
    if (!brailleOutput) { Alert.alert('Nothing to Export', 'Convert text first.'); return; }
    setExporting(true);
    try {
      const sourceInfo = fileName ?? 'Manual entry';
      const html = buildBraillePdf(brailleOutput, sourceInfo);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Braille PDF',
        });
      } else {
        Alert.alert('PDF Saved', uri);
      }
    } catch (err) {
      Alert.alert('Export Failed', (err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [brailleOutput, fileName]);

  // ── System print dialog ──────────────────────────────────────────────────────

  const handleSystemPrint = useCallback(async () => {
    if (!brailleOutput) { Alert.alert('Nothing to Print', 'Convert text first.'); return; }
    const html = buildBraillePdf(brailleOutput, fileName ?? 'Manual entry');
    await Print.printAsync({ html });
  }, [brailleOutput, fileName]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <LinearGradient colors={[C.cardDark, C.bg]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <LinearGradient
        colors={[C.card, C.cardDark]}
        style={[styles.header, { paddingTop: safeInsets.top + 14 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Braille Converter</Text>
          <Text style={styles.headerSub}>Grade 1 • Any document</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1: Input ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. Add Text</Text>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[C.blue, C.blueDark]}
              style={styles.uploadGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              {uploading
                ? <ActivityIndicator color={C.white} />
                : <Ionicons name="cloud-upload-outline" size={22} color={C.white} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadTitle}>
                  {fileName ? fileName : 'Upload Document'}
                </Text>
                <Text style={styles.uploadSub}>
                  PDF (digital) • DOCX • TXT — fully offline
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {uploadStatus ? (
            <Text style={styles.uploadStatus}>{uploadStatus}</Text>
          ) : null}

          <Text style={styles.orLabel}>— or type / paste below —</Text>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={6}
            placeholder="Type or paste text here…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={text => {
              setInputText(text);
              setBrailleOutput('');
              setBrailleCells([]);
              if (text !== inputText) setFileName(null);
            }}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {inputText.length > 0 && (
            <Text style={styles.charHint}>{inputText.length.toLocaleString()} characters</Text>
          )}
        </View>

        {/* ── Convert button ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.convertBtn, (!inputText.trim() || converting) && styles.btnDisabled]}
          onPress={handleConvert}
          disabled={converting || !inputText.trim()}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.purple, C.purpleDk]}
            style={styles.convertGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {converting
              ? <ActivityIndicator color={C.white} />
              : <Ionicons name="swap-horizontal" size={20} color={C.white} />}
            <Text style={styles.convertText}>
              {converting ? 'Converting…' : 'Convert to Braille'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Braille output ───────────────────────────────────────────── */}
        {brailleOutput.length > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.outputHeader}>
                <Text style={styles.sectionLabel}>2. Braille Output</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{brailleCells.length} cells</Text>
                </View>
              </View>

              <View style={styles.brailleCard}>
                <Text style={styles.brailleText} selectable>
                  {brailleOutput}
                </Text>
              </View>

              {/* Cell detail strip */}
              <Text style={styles.cellPreviewLabel}>Cell detail (first 50 cells)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.cellRow}
              >
                {brailleCells.slice(0, 50).map((cell, i) => (
                  <View key={i} style={styles.cellCard}>
                    <Text style={styles.cellUnicode}>{cell.unicode}</Text>
                    <Text style={styles.cellChar}>
                      {cell.character === ' ' ? '⎵' : cell.character}
                    </Text>
                    <View style={styles.dotGrid}>
                      {[0, 1, 2].map(row => (
                        <View key={row} style={styles.dotRow}>
                          {[0, 1].map(col => {
                            const dotNum = row + 1 + (col === 1 ? 3 : 0);
                            const active = cell.dots.includes(dotNum);
                            return (
                              <View
                                key={col}
                                style={[styles.dot, active && styles.dotActive]}
                              />
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* ── Actions ──────────────────────────────────────────────── */}
            <View style={styles.actionsSection}>
              <Text style={styles.sectionLabel}>3. Actions</Text>
              <View style={styles.actionsGrid}>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleExportPDF}
                  disabled={exporting}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(16,185,129,0.25)', 'rgba(5,150,105,0.12)']}
                    style={styles.actionGrad}
                  >
                    {exporting
                      ? <ActivityIndicator color={C.green} />
                      : <Ionicons name="document-text" size={28} color={C.green} />}
                    <Text style={[styles.actionTitle, { color: C.green }]}>Export PDF</Text>
                    <Text style={styles.actionSub}>Braille only, proper margins</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleSystemPrint}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(59,130,246,0.25)', 'rgba(37,99,235,0.12)']}
                    style={styles.actionGrad}
                  >
                    <Ionicons name="print" size={28} color={C.blue} />
                    <Text style={[styles.actionTitle, { color: C.blue }]}>Print</Text>
                    <Text style={styles.actionSub}>System print dialog</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionCard, !deviceConnected && styles.actionDisabled]}
                  onPress={handlePrint}
                  disabled={printing || !deviceConnected}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(139,92,246,0.25)', 'rgba(109,40,217,0.12)']}
                    style={styles.actionGrad}
                  >
                    {printing
                      ? <ActivityIndicator color={C.purple} />
                      : <Ionicons name="bluetooth" size={28} color={C.purple} />}
                    <Text style={[styles.actionTitle, { color: C.purple }]}>
                      Braille Device
                    </Text>
                    <Text style={styles.actionSub}>
                      {deviceConnected ? 'Print via BLE' : 'Not connected'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => {
                    setInputText('');
                    setBrailleOutput('');
                    setBrailleCells([]);
                    setFileName(null);
                    setUploadStatus('');
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['rgba(245,158,11,0.25)', 'rgba(217,119,6,0.12)']}
                    style={styles.actionGrad}
                  >
                    <Ionicons name="trash-outline" size={28} color={C.orange} />
                    <Text style={[styles.actionTitle, { color: C.orange }]}>Clear</Text>
                    <Text style={styles.actionSub}>Start over</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  headerSub: { fontSize: 12, color: C.dim, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: C.dim,
    letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase',
  },

  uploadBtn: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)',
  },
  uploadGrad: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  uploadTitle: { fontSize: 14, fontWeight: '600', color: C.white },
  uploadSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  uploadStatus: {
    fontSize: 12, color: C.green, marginBottom: 8, paddingHorizontal: 4,
  },

  orLabel: {
    textAlign: 'center', color: 'rgba(255,255,255,0.3)',
    fontSize: 12, marginVertical: 10, letterSpacing: 0.4,
  },

  textInput: {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14,
    color: C.white, fontSize: 14, lineHeight: 20, minHeight: 120,
  },
  charHint: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
    textAlign: 'right', marginTop: 4,
  },

  convertBtn: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)',
  },
  btnDisabled: { opacity: 0.5 },
  convertGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 15, gap: 10,
  },
  convertText: { fontSize: 16, fontWeight: '700', color: C.white },

  outputHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: C.purple },

  brailleCard: {
    backgroundColor: C.card, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  brailleText: {
    fontSize: 26, lineHeight: 38, letterSpacing: 4,
    color: C.white, fontWeight: '400',
  },

  cellPreviewLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
    marginBottom: 8, letterSpacing: 0.3,
  },
  cellRow: { marginBottom: 4 },
  cellCard: {
    backgroundColor: C.card, borderRadius: 10, padding: 8,
    marginRight: 8, alignItems: 'center',
    borderWidth: 1, borderColor: C.border, minWidth: 48,
  },
  cellUnicode: { fontSize: 20, color: C.white, marginBottom: 2 },
  cellChar:    { fontSize: 10, color: C.dim, marginBottom: 4 },
  dotGrid: { gap: 3 },
  dotRow:  { flexDirection: 'row', gap: 3 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { backgroundColor: C.blue },

  actionsSection: { marginBottom: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  actionDisabled: { opacity: 0.45 },
  actionGrad: {
    alignItems: 'center', justifyContent: 'center',
    padding: 16, minHeight: 110,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  actionSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, textAlign: 'center' },
});

export default BrailleConvertScreen;
