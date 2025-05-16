const { utilityFunction1, utilityFunction2 } = require('../utils');

test('utilityFunction1 should return expected result', () => {
	expect(utilityFunction1(input)).toBe(expectedOutput);
});

test('utilityFunction2 should handle edge cases', () => {
	expect(utilityFunction2(edgeCaseInput)).toBe(edgeCaseExpectedOutput);
});