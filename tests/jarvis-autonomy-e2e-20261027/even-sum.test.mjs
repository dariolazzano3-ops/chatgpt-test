import test from 'node:test';
import assert from 'node:assert/strict';
import { sumEvenIntegers } from './even-sum.mjs';

test('sums only non-negative even integers', () => {
  assert.equal(sumEvenIntegers([1, 2, 3, 4, 5, 6]), 12);
});
test('ignores odd, negative and non-integer values', () => {
  assert.equal(sumEvenIntegers([-2, 2, 3, 4, 4.5, '6']), 6);
});
test('returns zero for empty input', () => {
  assert.equal(sumEvenIntegers([]), 0);
});
test('rejects non-array input', () => {
  assert.throws(() => sumEvenIntegers(null), TypeError);
});
