/**
 * PHI, PII, and prompt-injection scanner for free-text fields.
 *
 * This is the single implementation behind `decisionReasonScanned` and
 * `revisionInstructionsSanitized`. Neither marker may be set to true without
 * calling one of the exports in this module and receiving passed: true.
 *
 * Two scan surfaces:
 *   - scanText        PHI/PII only — for decision reasons (approval-event.schema.json)
 *   - scanRevision    PHI/PII + prompt-injection — for revision instructions
 *                     (shift-closeout-agent-input.schema.json)
 */

const PHI_RULES = [
  {
    id: 'ssn',
    description: 'national identification number (SSN/TIN pattern)',
    re: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    id: 'email',
    description: 'email address',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
  {
    id: 'phone',
    description: 'telephone number',
    re: /(?:^|[\s(:="'])(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  },
  {
    id: 'mrn',
    description: 'medical record number assignment',
    re: /\bMRN\s*[:=]\s*\S+/i,
  },
  {
    id: 'dob',
    description: 'date of birth direct label',
    re: /\b(?:date\s+of\s+birth|DOB)\s*[:=]\s*\S+/i,
  },
];

const INJECTION_RULES = [
  {
    id: 'injection-ignore-directive',
    description: 'prompt injection — ignore/forget instruction override',
    re: /\b(?:ignore|forget|disregard)\s+(?:previous|prior|all|above|your)\s+(?:instructions?|directives?|rules?|context)/i,
  },
  {
    id: 'injection-role-override',
    description: 'prompt injection — role or persona override',
    re: /\byou\s+are\s+(?:now|a\s+new|an?\s+unrestricted|no\s+longer)/i,
  },
  {
    id: 'injection-system-delimiter',
    description: 'prompt injection — system/instruction delimiter pattern',
    re: /(?:<\s*(?:system|instruction|prompt|override)\s*>|\[(?:SYSTEM|INST|INSTRUCTION|OVERRIDE)\]|#{3,}\s*(?:SYSTEM|INSTRUCTION|OVERRIDE))/i,
  },
  {
    id: 'injection-jailbreak-token',
    description: 'prompt injection — known jailbreak prefix token',
    re: /\b(?:DAN|JAILBREAK|DEVELOPER\s+MODE|SUDO\s+MODE|ADMIN\s+OVERRIDE)\b/i,
  },
  {
    id: 'injection-reveal-instructions',
    description: 'prompt injection — request to reveal system instructions',
    re: /\b(?:reveal|print|output|show|repeat|expose)\s+(?:your\s+)?(?:system\s+)?(?:instructions?|prompt|directives?)\b/i,
  },
];

function applyRules(text, rules) {
  const findings = [];
  for (const rule of rules) {
    if (rule.re.test(text)) {
      findings.push({ ruleId: rule.id, description: rule.description });
    }
  }
  return findings;
}

/**
 * Scan free text for PHI/PII patterns only.
 * Use for decision reasons before setting `decisionReasonScanned: true`.
 *
 * @param {string} text
 * @returns {{ passed: boolean, findings: Array<{ ruleId: string, description: string }> }}
 */
export function scanText(text) {
  if (typeof text !== 'string') {
    return { passed: false, findings: [{ ruleId: 'invalid-input', description: 'input was not a string' }] };
  }
  const findings = applyRules(text, PHI_RULES);
  return { passed: findings.length === 0, findings };
}

/**
 * Scan revision instructions for both PHI/PII and prompt-injection patterns.
 * Use before setting `revisionInstructionsSanitized: true`.
 * Revision text is treated as untrusted content that may reach an LLM.
 *
 * @param {string} text
 * @returns {{ passed: boolean, findings: Array<{ ruleId: string, description: string }> }}
 */
export function scanRevision(text) {
  if (typeof text !== 'string') {
    return { passed: false, findings: [{ ruleId: 'invalid-input', description: 'input was not a string' }] };
  }
  const findings = [
    ...applyRules(text, PHI_RULES),
    ...applyRules(text, INJECTION_RULES),
  ];
  return { passed: findings.length === 0, findings };
}
