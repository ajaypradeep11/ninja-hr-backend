export type ProvinceCode = 'ON' | 'BC' | 'AB' | 'QC' | 'SK' | 'MB' | 'NS' | 'NB';

export interface Province {
  code: ProvinceCode;
  name: string;
}

export const PROVINCES: Province[] = [
  { code: 'ON', name: 'Ontario' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NB', name: 'New Brunswick' },
];

export function provinceName(code: ProvinceCode): string {
  return PROVINCES.find((p) => p.code === code)?.name ?? code;
}
