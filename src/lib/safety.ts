/** Blocks model output that mentions medicine, dosing, symptoms or money-transfer scams; such text must never be stored or shown. */
export const UNSAFE_PATTERN =
  /\b(pill|pills|medic\w*|dose|doses|dosage|\d+\s?mg|tablet\w*|prescri\w*|symptom\w*|diagnos\w*|insulin|blood pressure|gift ?cards?|wire transfer|transfer (money|funds)|bank account|routing number)\b/i;
/** Extra rule for memory: no food, sleep or health tracking. */
export const MEMORY_EXCLUDE = /\b(slept|sleep\w*|breakfast|toast|ate|eaten|lunch|dinner|weight|pain|tired)\b/i;
