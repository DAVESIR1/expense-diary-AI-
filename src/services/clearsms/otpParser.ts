/**
 * ClearSMS OTP Parser ported to TypeScript
 * 
 * Extracts verification codes and prevents OTP authorization messages
 * quoting amounts from fabricating transactions.
 */

const KEYWORD_PATTERNS = [
  /(?:otp|verification\s+code|security\s+code|authori[sz]ation\s+code|code|password|pin)\s*(?:is\s*:?|:)?\s*(\d{4,8})(?!\d)/i,
  /(?<!\d)(\d{4,8})\s+is\s+(?:(?:your|the)\s+)?(?:\w+[ .-]){0,3}?(?:otp|one[\s-]?time|verification|code|password|pin)\b/i,
  /(?:use|enter)\s+(?:otp\s+)?(\d{4,8})\s+(?:to|for|as)/i,
];

const VERIFICATION_CONTEXT = /\b(?:otp|verif\w*|authenticat\w*|one[\s-]?time|login|log[\s-]?in|sign[\s-]?in|code|password|pin)\b/i;
const BARE_SIX_DIGITS = /(?<!\d)(\d{6})(?!\d)/;

export const OtpParser = {
  /**
   * Keyword-anchored extraction only: code sits directly against an OTP/PIN keyword
   */
  parseAnchored(body: string): { code: string } | null {
    for (const pat of KEYWORD_PATTERNS) {
      const match = pat.exec(body);
      if (match && match[1]) {
        return { code: match[1] };
      }
    }
    return null;
  },

  /**
   * General OTP parse
   */
  parse(body: string): { code: string } | null {
    const anchored = this.parseAnchored(body);
    if (anchored) return anchored;

    if (VERIFICATION_CONTEXT.test(body)) {
      const bare = BARE_SIX_DIGITS.exec(body);
      if (bare && bare[1]) {
        return { code: bare[1] };
      }
    }
    return null;
  },
};
