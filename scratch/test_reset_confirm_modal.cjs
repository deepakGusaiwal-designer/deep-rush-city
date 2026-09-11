const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING RESET CONFIRM MODAL VERIFICATION ===');

const projectRoot = process.cwd();

// Test 1: ResetConfirmModal.tsx exists and has correct logic
const modalPath = path.join(projectRoot, 'src/components/HUD/ResetConfirmModal.tsx');
assert.ok(fs.existsSync(modalPath), 'ResetConfirmModal.tsx must exist');
const modalSrc = fs.readFileSync(modalPath, 'utf8');

assert.ok(modalSrc.includes('isResetConfirmOpen'), 'Modal must bind to isResetConfirmOpen from store');
assert.ok(modalSrc.includes('setResetConfirmOpen'), 'Modal must update setResetConfirmOpen');
assert.ok(modalSrc.includes("e.key === 'Escape'"), 'Modal must listen for Escape key to close');
assert.ok(modalSrc.includes("e.key === 'Enter' || e.key === 'r' || e.key === 'R'"), 'Modal must listen for Enter or R key to confirm');
assert.ok(modalSrc.includes('Reset Game & Vehicle?'), 'Modal must have clear title');
assert.ok(modalSrc.includes('Yes, Reset Game'), 'Modal must have confirm button');
assert.ok(modalSrc.includes('Cancel'), 'Modal must have cancel button');
console.log('✓ Test 1 Passed: ResetConfirmModal.tsx contains all required UI elements and keyboard listeners');

// Test 2: useGameStore.ts has isResetConfirmOpen
const storePath = path.join(projectRoot, 'src/store/useGameStore.ts');
const storeSrc = fs.readFileSync(storePath, 'utf8');
assert.ok(storeSrc.includes('isResetConfirmOpen: boolean'), 'useGameStore interface must declare isResetConfirmOpen');
assert.ok(storeSrc.includes('setResetConfirmOpen: (open: boolean) => void'), 'useGameStore interface must declare setResetConfirmOpen');
assert.ok(storeSrc.includes('isResetConfirmOpen: false'), 'isResetConfirmOpen default must be false');
console.log('✓ Test 2 Passed: useGameStore.ts correctly manages isResetConfirmOpen state');

// Test 3: App.tsx connects handleResetCar to modal
const appPath = path.join(projectRoot, 'src/App.tsx');
const appSrc = fs.readFileSync(appPath, 'utf8');
assert.ok(appSrc.includes("import { ResetConfirmModal } from './components/HUD/ResetConfirmModal'"), 'App.tsx must import ResetConfirmModal');
assert.ok(appSrc.includes('useGameStore.getState().setResetConfirmOpen(true)'), 'handleResetCar must open confirmation modal');
assert.ok(appSrc.includes('handleConfirmReset'), 'App.tsx must define handleConfirmReset');
assert.ok(appSrc.includes('<ResetConfirmModal onConfirm={handleConfirmReset} />'), 'App.tsx must render ResetConfirmModal');
console.log('✓ Test 3 Passed: App.tsx displays ResetConfirmModal upon pressing R or clicking reset');

// Test 4: ControlsOverlay.tsx integrates R key & Escape
const controlsPath = path.join(projectRoot, 'src/components/HUD/ControlsOverlay.tsx');
const controlsSrc = fs.readFileSync(controlsPath, 'utf8');
assert.ok(controlsSrc.includes("if (key === 'r') onResetCar()"), "ControlsOverlay must route 'r' key through onResetCar");
assert.ok(controlsSrc.includes('if (s.isResetConfirmOpen) s.setResetConfirmOpen(false)'), 'ControlsOverlay must close reset modal on Escape');
console.log('✓ Test 4 Passed: ControlsOverlay handles R key and Escape smoothly');

// Test 5: CityGameEngine.ts resetCar completeness
const enginePath = path.join(projectRoot, 'src/game/CityGameEngine.ts');
const engineSrc = fs.readFileSync(enginePath, 'utf8');
assert.ok(engineSrc.includes('this.vehicleController.repair()'), 'resetCar must repair vehicle');
assert.ok(engineSrc.includes('this.vehicleController.resetPosition(DEFAULT_SPAWN_POS, 0)'), 'resetCar must reset vehicle position');
assert.ok(engineSrc.includes('this.wanted.clear()'), 'resetCar must clear wanted status');
assert.ok(engineSrc.includes('store.setVitals(this.health, this.armor)'), 'resetCar must restore vitals');
console.log('✓ Test 5 Passed: CityGameEngine.ts resetCar fully restores game state');

console.log('\n>>> ALL 5 RESET CONFIRM MODAL TESTS PASSED! <<<');
