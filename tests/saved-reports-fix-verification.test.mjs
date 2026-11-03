/**
 * Verification test for saved-reports fix (commit correctness)
 * Checks:
 * 1. src/routes/saved-reports/index.tsx exists and exports Route
 * 2. src/routes/saved-reports/$id.tsx has useNavigate import
 * 3. Back button exists in detail page
 * 4. Route tree includes both saved-reports routes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('🔍 Saved Reports Fix Verification Test\n');

// Test 1: Check index.tsx exists
console.log('✓ Test 1: Checking src/routes/saved-reports/index.tsx exists...');
const indexPath = path.join(projectRoot, 'src/routes/saved-reports/index.tsx');
if (!fs.existsSync(indexPath)) {
  console.error('❌ FAILED: index.tsx does not exist at', indexPath);
  process.exit(1);
}
const indexContent = fs.readFileSync(indexPath, 'utf-8');
if (!indexContent.includes('export const Route')) {
  console.error('❌ FAILED: index.tsx does not export Route');
  process.exit(1);
}
if (!indexContent.includes('SavedReportsListPage')) {
  console.error('❌ FAILED: index.tsx does not export SavedReportsListPage component');
  process.exit(1);
}
console.log('  ✅ index.tsx exists and exports Route');

// Test 2: Check $id.tsx has useNavigate import
console.log('\n✓ Test 2: Checking src/routes/saved-reports/$id.tsx imports useNavigate...');
const idPath = path.join(projectRoot, 'src/routes/saved-reports/$id.tsx');
if (!fs.existsSync(idPath)) {
  console.error('❌ FAILED: $id.tsx does not exist at', idPath);
  process.exit(1);
}
const idContent = fs.readFileSync(idPath, 'utf-8');
if (!idContent.includes('import { createFileRoute, useNavigate }')) {
  console.error('❌ FAILED: $id.tsx does not import useNavigate');
  process.exit(1);
}
console.log('  ✅ $id.tsx correctly imports useNavigate');

// Test 3: Check useNavigate is used
console.log('\n✓ Test 3: Checking useNavigate is actually used in $id.tsx...');
if (!idContent.includes('const navigate = useNavigate()')) {
  console.error('❌ FAILED: useNavigate() hook is not called');
  process.exit(1);
}
if (!idContent.includes('navigate({ to: "/saved-reports" })')) {
  console.error('❌ FAILED: navigate() is not used to go back to list');
  process.exit(1);
}
console.log('  ✅ useNavigate hook is properly used for navigation');

// Test 4: Check back button exists
console.log('\n✓ Test 4: Checking back button exists in detail page...');
if (!idContent.includes('Back to reports')) {
  console.error('❌ FAILED: Back button text not found');
  process.exit(1);
}
if (!idContent.includes('ArrowLeft')) {
  console.error('❌ FAILED: ArrowLeft icon import missing');
  process.exit(1);
}
console.log('  ✅ Back button with arrow icon is present');

// Test 5: Check route tree includes both routes
console.log('\n✓ Test 5: Checking src/routeTree.gen.ts includes both saved-reports routes...');
const routeTreePath = path.join(projectRoot, 'src/routeTree.gen.ts');
if (!fs.existsSync(routeTreePath)) {
  console.error('❌ FAILED: routeTree.gen.ts does not exist');
  process.exit(1);
}
const routeTreeContent = fs.readFileSync(routeTreePath, 'utf-8');
if (!routeTreeContent.includes("import { Route as SavedReportsIndexRouteImport } from './routes/saved-reports/index'")) {
  console.error('❌ FAILED: Route tree does not import saved-reports/index');
  process.exit(1);
}
if (!routeTreeContent.includes("import { Route as SavedReportsIdRouteImport } from './routes/saved-reports/$id'")) {
  console.error('❌ FAILED: Route tree does not import saved-reports/$id');
  process.exit(1);
}
console.log('  ✅ Route tree imports both saved-reports routes');

// Test 6: Check API endpoints are present
console.log('\n✓ Test 6: Checking API endpoint calls in list and detail pages...');
if (!indexContent.includes('/api/reports')) {
  console.error('❌ FAILED: List page does not call /api/reports');
  process.exit(1);
}
if (!idContent.includes('/api/reports/' + '${id}')) {
  console.error('❌ FAILED: Detail page does not call /api/reports/{id}');
  process.exit(1);
}
console.log('  ✅ API endpoints are correctly referenced');

console.log('\n' + '='.repeat(50));
console.log('✅ ALL TESTS PASSED - Saved Reports Fix Verified!');
console.log('='.repeat(50));
console.log('\nSummary:');
console.log('- index.tsx is present and exports Route');
console.log('- $id.tsx has useNavigate import and uses it');
console.log('- Back button is implemented with ArrowLeft icon');
console.log('- Route tree includes both saved-reports routes');
console.log('- API calls are correctly implemented');
console.log('\n✅ Ready for commit and push!');
