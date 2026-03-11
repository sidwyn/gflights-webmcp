import vm from 'vm';
import { readFileSync } from 'fs';

/**
 * Load a vanilla JS source file and return the const/class it defines.
 * Uses vm.runInThisContext to execute in the current global scope.
 */
export function loadSource(filePath) {
  const source = readFileSync(filePath, 'utf-8');
  // Replace `const X = ` and `class X ` with globalThis assignments
  const modified = source
    .replace(/^const\s+(\w+)\s*=/gm, 'globalThis.$1 =')
    .replace(/^class\s+(\w+)\s+extends\s+/gm, 'globalThis.$1 = class $1 extends ')
    .replace(/^class\s+(\w+)\s*\{/gm, 'globalThis.$1 = class $1 {');
  vm.runInThisContext(modified, { filename: filePath });
}

/**
 * Load a source file and return the named export.
 */
export function loadTool(filePath, name) {
  loadSource(filePath);
  return globalThis[name];
}
