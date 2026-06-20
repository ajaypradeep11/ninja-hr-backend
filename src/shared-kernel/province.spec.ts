import { provinceName, PROVINCES } from './province';

describe('province', () => {
  it('maps codes to names', () => {
    expect(provinceName('ON')).toBe('Ontario');
    expect(provinceName('QC')).toBe('Quebec');
  });
  it('lists all 8 provinces', () => {
    expect(PROVINCES).toHaveLength(8);
  });
});
