import { describe, it, expect } from 'vitest';
import { SkillService } from './skill.service';

// Access private methods for testing by casting to any
const getService = () => {
    return new SkillService() as any;
};

describe('SkillService Security', () => {
  describe('validatePackageName', () => {
    it('should reject package names starting with hyphen', () => {
      const service = getService();
      // Current implementation allows these, so this test should fail before fix
      expect(service.validatePackageName('-g')).toBe(false);
      expect(service.validatePackageName('--unsafe')).toBe(false);
    });

    it('should accept valid package names', () => {
      const service = getService();
      expect(service.validatePackageName('safe-package')).toBe(true);
      expect(service.validatePackageName('pkg-1')).toBe(true);
      expect(service.validatePackageName('@scope/package')).toBe(true);
    });
  });

  describe('validateSkillName', () => {
    it('should reject dangerous path components', () => {
      const service = getService();
      // Current implementation might allow '.', so this test should fail before fix
      expect(service.validateSkillName('.')).toBe(false);
      expect(service.validateSkillName('..')).toBe(false);
    });

    it('should accept valid skill names', () => {
      const service = getService();
      expect(service.validateSkillName('my-skill')).toBe(true);
      expect(service.validateSkillName('skill_123')).toBe(true);
    });
  });
});
