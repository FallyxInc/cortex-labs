/**
 * Tests for care plan processor
 * Focuses on fluid target and maximum extraction
 */

import {
  extractFluidTargetsMl,
  extractFluidMaximumsMl,
  extractResidentNames,
  extractFeedingTubeInfo,
} from '../careplanProcessor';

describe('Care Plan Processor', () => {
  describe('extractFluidMaximumsMl', () => {
    it('should extract maximum from "FLUID TARGET: minimum 1500ml maximum 1800ml"', () => {
      const text = 'FLUID TARGET: minimum 1500ml maximum 1800ml';
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(1800);
    });

    it('should extract maximum from "FLUID TARGET minimum 1500mL maximum 2000mL"', () => {
      const text = 'FLUID TARGET minimum 1500mL maximum 2000mL';
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(2000);
    });

    it('should extract maximum with various spacing', () => {
      const text = 'FLUID  TARGET: 1500ml   maximum   1800mL';
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(1800);
    });

    it('should extract maximum when on same line as FLUID TARGET', () => {
      const text = `
        Some other text here
        FLUID TARGET: 1500ml, maximum 2000ml per day
        More text follows
      `;
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(2000);
    });

    it('should extract maximum with uppercase ML', () => {
      const text = 'FLUID TARGET 1500ML maximum 1800ML';
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(1800);
    });

    it('should return empty array when no maximum is present', () => {
      const text = 'FLUID TARGET: 1500ml per day';
      const result = extractFluidMaximumsMl(text);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no FLUID TARGET is present', () => {
      const text = 'maximum 1800ml';
      const result = extractFluidMaximumsMl(text);
      expect(result).toHaveLength(0);
    });

    it('should handle multiple maximums and remove duplicates', () => {
      const text = `
        FLUID TARGET: 1500ml maximum 1800ml
        FLUID TARGET: 1500ml maximum 1800ml
      `;
      const result = extractFluidMaximumsMl(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(1800);
    });

    it('should extract multiple different maximums', () => {
      const text = `
        FLUID TARGET: 1500ml maximum 1800ml
        FLUID TARGET: 2000ml maximum 2500ml
      `;
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(1800);
      expect(result).toContain(2500);
    });

    it('should handle maximum appearing after FLUID TARGET on multiline', () => {
      const text = `FLUID TARGET: Encourage a
      minimum of 1500ml and a
      maximum 2000ml daily`;
      const result = extractFluidMaximumsMl(text);
      expect(result).toContain(2000);
    });

    it('should not extract numbers less than 3 digits', () => {
      const text = 'FLUID TARGET maximum 50ml';
      const result = extractFluidMaximumsMl(text);
      expect(result).toHaveLength(0);
    });

    // it('should extract maximum with comma in number', () => {
    //   const text = 'FLUID TARGET maximum 2,000ml';
    //   const result = extractFluidMaximumsMl(text);
    //   expect(result).toContain(2000);
    // });
  });

  describe('extractFluidTargetsMl', () => {
    it('should extract target from "FLUID TARGET: 1500ml"', () => {
      const text = 'FLUID TARGET: 1500ml';
      const result = extractFluidTargetsMl(text);
      expect(result).toContain(1500);
    });

    it('should extract target from "FLUID TARGET 2000mL"', () => {
      const text = 'FLUID TARGET 2000mL';
      const result = extractFluidTargetsMl(text);
      expect(result).toContain(2000);
    });

    it('should extract multiple targets', () => {
      const text = `
        FLUID TARGET: 1500ml
        FLUID TARGET: 2000ml
      `;
      const result = extractFluidTargetsMl(text);
      expect(result).toContain(1500);
      expect(result).toContain(2000);
    });

    it('should remove duplicate targets', () => {
      const text = `
        FLUID TARGET: 1500ml
        FLUID TARGET: 1500ml
      `;
      const result = extractFluidTargetsMl(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(1500);
    });

    it('should return empty array when no target present', () => {
      const text = 'No fluid information here';
      const result = extractFluidTargetsMl(text);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractFluidTargetsMl and extractFluidMaximumsMl together', () => {
    it('should extract both target and maximum from same text', () => {
      const text = 'FLUID TARGET: minimum 1500ml maximum 1800ml';
      const targets = extractFluidTargetsMl(text);
      const maximums = extractFluidMaximumsMl(text);

      expect(targets).toContain(1500);
      expect(maximums).toContain(1800);
    });

    it('should extract both from care plan style text', () => {
      const text = `
        Patient Care Plan
        ==================

        Hydration Goals:
        FLUID TARGET: Encourage minimum of 1500mL per day, maximum 2000mL

        Notes: Monitor intake closely
      `;
      const targets = extractFluidTargetsMl(text);
      const maximums = extractFluidMaximumsMl(text);

      expect(targets).toContain(1500);
      expect(maximums).toContain(2000);
    });

    it('should handle target without maximum', () => {
      const text = 'FLUID TARGET: 1500ml per day';
      const targets = extractFluidTargetsMl(text);
      const maximums = extractFluidMaximumsMl(text);

      expect(targets).toContain(1500);
      expect(maximums).toHaveLength(0);
    });
  });

  describe('extractResidentNames', () => {
    it('should extract name with 4+ digit ID', () => {
      const text = 'Smith, John (12345)';
      const result = extractResidentNames(text);
      expect(result).toContain('Smith, John');
    });

    it('should extract name with dash format ID', () => {
      const text = 'Doe, Jane (123-45)';
      const result = extractResidentNames(text);
      expect(result).toContain('Doe, Jane');
    });

    it('should skip names containing skip words', () => {
      const text = 'Admission Date, Test (12345)';
      const result = extractResidentNames(text);
      expect(result).not.toContain('Admission Date, Test');
    });

    it('should remove duplicate names', () => {
      const text = `
        Smith, John (12345)
        Smith, John (12345)
      `;
      const result = extractResidentNames(text);
      const smithCount = result.filter(n => n === 'Smith, John').length;
      expect(smithCount).toBe(1);
    });
  });

  describe('extractFeedingTubeInfo', () => {
    it('should detect "feeding tube"', () => {
      const text = 'Patient has a feeding tube';
      expect(extractFeedingTubeInfo(text)).toBe(true);
    });

    it('should detect "G tube"', () => {
      const text = 'Patient uses G tube for nutrition';
      expect(extractFeedingTubeInfo(text)).toBe(true);
    });

    it('should detect "PEG tube"', () => {
      const text = 'PEG tube inserted last month';
      expect(extractFeedingTubeInfo(text)).toBe(true);
    });

    it('should detect "enteral nutrition"', () => {
      const text = 'Receiving enteral nutrition';
      expect(extractFeedingTubeInfo(text)).toBe(true);
    });

    it('should return false when no feeding tube info', () => {
      const text = 'Patient eats normally';
      expect(extractFeedingTubeInfo(text)).toBe(false);
    });
  });
});
