/**
 * Isolated JARVIS acceptance fixture: sum non-negative even integers.
 * Intentionally broken in the first commit to prove test failure detection.
 */
export function sumEvenIntegers(values) {
  if (!Array.isArray(values)) throw new TypeError('Expected an array');
  return values
    .filter((value) => Number.isInteger(value) && value >= 0 && value % 2 === 0)
    .reduce((total, value) => total + value, 0);
}
