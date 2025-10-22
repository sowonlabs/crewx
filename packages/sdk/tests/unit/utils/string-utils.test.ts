// SDK Utility Tests
import { describe, it, expect } from 'vitest';
import { capitalizeFirstLetter } from '../../../src/utils/string-utils';

describe('StringUtils', () => {
  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter of a string', () => {
      const result = capitalizeFirstLetter('hello');
      expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalizeFirstLetter('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(capitalizeFirstLetter(null as any)).toBe(null);
      expect(capitalizeFirstLetter(undefined as any)).toBe(undefined);
    });

    it('should not modify already capitalized string', () => {
      const result = capitalizeFirstLetter('Hello');
      expect(result).toBe('Hello');
    });

    it('should handle single character', () => {
      const result = capitalizeFirstLetter('a');
      expect(result).toBe('A');
    });
  });
});