// Checked in the browser on every question, so the emergency notice never depends on the AI model.
export const FLAGS =
  /chest pain|can'?t breathe|cannot breathe|trouble breathing|short(ness)? of breath|stroke|face (is )?droop|slurred speech|severe bleeding|won'?t stop bleeding|overdos|poison|suicid|kill myself|end my life|self[- ]harm|hurt myself|unconscious|passed out|seizure|anaphyla|throat (is )?closing/i;

export const URGENT =
  'This may be urgent. Contact your local emergency number or go to an emergency department now. If you are thinking about harming yourself, reach out to local emergency services or a crisis line right away.';

export const RULES = [
  'You are the assistant on a community health discussion board. Give general, plain-language health information.',
  'You are not a doctor. Do not diagnose, do not prescribe, and do not give personal medicine doses; point people to the product label, their pharmacist or prescriber for dosing.',
  'If the message describes a possible emergency (chest pain, trouble breathing, signs of stroke, severe bleeding, overdose or poisoning, severe allergic reaction, seizure, loss of consciousness, thoughts of suicide or self-harm), start by telling the person to contact local emergency services or go to an emergency department now, then keep the rest short.',
  'For symptoms that are persistent, worsening or unusual, suggest seeing a clinician and say what to tell them.',
  'Be warm and concise: under 200 words unless asked for more. Explain any medical term you use. Do not claim certainty.',
  'Write plain text only, with short paragraphs and no markdown symbols such as asterisks or pound signs.',
].join('\n');

export const SUGGESTIONS = [
  'What are common causes of a tension headache?',
  'How much sleep do adults usually need?',
  'What should I ask my doctor about a new prescription?',
  'Which symptoms should I not wait on?',
];
