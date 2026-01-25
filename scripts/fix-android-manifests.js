#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing AndroidManifest.xml package attributes...');

// List of libraries that need their package attribute removed
const librariesToFix = [
  'lottie-react-native',
  '@react-native-async-storage/async-storage',
  'react-native-ble-manager',
  '@react-native-community/netinfo',
  'react-native-safe-area-context',
  'react-native-vector-icons',
  '@react-native-voice/voice'
];

let fixedCount = 0;

librariesToFix.forEach(lib => {
  const manifestPath = path.join(
    __dirname,
    '..',
    'node_modules',
    lib,
    'android',
    'src',
    'main',
    'AndroidManifest.xml'
  );

  if (fs.existsSync(manifestPath)) {
    try {
      let content = fs.readFileSync(manifestPath, 'utf8');
      
      // Remove package attribute from manifest tag
      const originalContent = content;
      content = content.replace(
        /<manifest([^>]*)\s+package="[^"]*"([^>]*)>/,
        '<manifest$1$2>'
      );

      if (content !== originalContent) {
        fs.writeFileSync(manifestPath, content, 'utf8');
        console.log(`✅ Fixed: ${lib}`);
        fixedCount++;
      } else {
        console.log(`⏭️  Skipped: ${lib} (no package attribute found)`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${lib}:`, error.message);
    }
  } else {
    console.log(`⚠️  Not found: ${manifestPath}`);
  }
});

console.log(`\n✨ Fixed ${fixedCount} AndroidManifest.xml files`);
