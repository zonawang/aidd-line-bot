export const syntheticUtcMs = Date.UTC(2024, 1, 29, 12);

export function createSyntheticScenario(profile: string, ordinal = 1) {
  if (profile !== 'synthetic') {
    throw new Error('synthetic_profile_required');
  }
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 20) {
    throw new RangeError('invalid_synthetic_subject');
  }
  return Object.freeze({
    profile: 'synthetic' as const,
    subjectKey: `synthetic-subject-${ordinal.toString().padStart(2, '0')}`,
    location: Object.freeze({ latitude: 0, longitude: 0 }),
    queryAtMs: syntheticUtcMs,
  });
}
