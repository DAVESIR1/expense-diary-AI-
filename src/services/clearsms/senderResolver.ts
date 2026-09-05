/**
 * ClearSMS Sender Name & Financial Institution Resolver ported to TypeScript
 * 
 * Maps TRAI sender IDs (e.g. 'VM-HDFCBK' -> 'HDFC Bank', 'PTNNPS' -> 'NPS')
 * and body narrations to canonical institutions using curated brands.json.
 */

import brandsData from './brands.json';

export interface Institution {
  name: string;
  senderKeys: string[];
  aliases: string[];
  isIssuer: boolean;
  isCardProduct: boolean;
  isWalletProduct: boolean;
  isRetirementProduct: boolean;
}

interface BrandJson {
  name: string;
  category?: string;
  senders?: string[];
  aliases?: string[];
  is_issuer?: boolean;
  issuer_name?: string;
  issuer_senders?: string[];
  issuer_aliases?: string[];
}

const INSTITUTIONS: Institution[] = [];

for (const b of (brandsData.brands as BrandJson[])) {
  const isIssuer = b.is_issuer ?? false;
  INSTITUTIONS.push({
    name: b.issuer_name || b.name,
    senderKeys: (b.issuer_senders || b.senders || []).map((s) => s.toUpperCase()),
    aliases: (b.issuer_aliases || b.aliases || []).map((a) => a.toUpperCase()),
    isIssuer: isIssuer,
    isCardProduct: b.category === 'CARD',
    isWalletProduct: b.category === 'WALLET',
    isRetirementProduct: b.category === 'INVESTMENT',
  });
}

// Aliases sorted longest-first so "Paytm Payments Bank" wins over "Paytm"
const aliasIndex: { regex: RegExp; institution: Institution; patternHasBank: boolean }[] = [];

const allAliases: { alias: string; institution: Institution }[] = [];
for (const inst of INSTITUTIONS) {
  for (const alias of inst.aliases) {
    allAliases.push({ alias, institution: inst });
  }
}

allAliases.sort((a, b) => b.alias.length - a.alias.length);

for (const item of allAliases) {
  const escaped = item.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, 'g');
  aliasIndex.push({
    regex,
    institution: item.institution,
    patternHasBank: item.alias.includes('BANK'),
  });
}

export const SenderNameResolver = {
  /**
   * Strips TRAI prefix ("VM-", "AD-") and suffix ("-S", "-T")
   */
  normalizeSender(sender: string): string {
    let s = sender.trim().toUpperCase();
    if (s.length > 3 && s[2] === '-' && /^[A-Z0-9]{2}/.test(s)) {
      s = s.substring(3);
    }
    if (s.length > 2 && s[s.length - 2] === '-' && 'STPG'.includes(s[s.length - 1])) {
      s = s.substring(0, s.length - 2);
    }
    return s;
  },

  /**
   * Human-readable canonical institution name for sender/body
   */
  bankNameFor(senderId: string, body: string = ''): string | null {
    const bodyMatch = this.matchBodyInstitution(body);
    if (bodyMatch.own) return bodyMatch.own.name;

    const normalized = this.normalizeSender(senderId);
    if (normalized) {
      const foundBySender = INSTITUTIONS.find((inst) =>
        inst.senderKeys.some((k) => normalized.includes(k))
      );
      if (foundBySender) return foundBySender.name;

      const foundByAlias = this.matchAlias(normalized);
      if (foundByAlias) return foundByAlias.name;
    }

    if (bodyMatch.mentioned) return bodyMatch.mentioned.name;

    return normalized.length > 0 ? normalized : null;
  },

  /**
   * Resolves brand name (without raw shortcode fallback)
   */
  brandNameFor(senderId: string, body: string = ''): string | null {
    const bodyMatch = this.matchBodyInstitution(body);
    if (bodyMatch.own) return bodyMatch.own.name;

    const normalized = this.normalizeSender(senderId);
    if (normalized) {
      const foundBySender = INSTITUTIONS.find((inst) =>
        inst.senderKeys.some((k) => normalized.includes(k))
      );
      if (foundBySender) return foundBySender.name;

      const foundByAlias = this.matchAlias(normalized);
      if (foundByAlias) return foundByAlias.name;
    }

    return bodyMatch.mentioned?.name || null;
  },

  /**
   * Checks if name is a plausible account issuer (banks, wallets, retirement products)
   * Prevents merchants like Flipkart, Swiggy, or CRED from fabricating accounts.
   */
  isPlausibleIssuer(name?: string | null, body: string = ''): boolean {
    const trimmed = name?.trim() || '';
    if (!trimmed) return false;
    const upper = trimmed.toUpperCase();

    const matched = this.matchAlias(upper);
    if (matched) return matched.isIssuer;

    if (upper.includes('BANK')) return true;

    if (body.length > 0) {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchored = new RegExp(`(?<![A-Za-z0-9])${escaped}\\s+(?:bank|card|a/c|acct|account|wallet)\\b`, 'i');
      if (anchored.test(body)) return true;
    }

    return false;
  },

  canonicalize(name?: string | null): string | null {
    const trimmed = name?.trim() || '';
    if (!trimmed) return null;
    const matched = this.matchAlias(trimmed.toUpperCase());
    return matched ? matched.name : trimmed;
  },

  matchAlias(upperText: string): Institution | null {
    if (!upperText) return null;
    for (const item of aliasIndex) {
      item.regex.lastIndex = 0;
      if (item.regex.test(upperText)) {
        return item.institution;
      }
    }
    return null;
  },

  matchBodyInstitution(body: string): { own: Institution | null; mentioned: Institution | null } {
    if (!body) return { own: null, mentioned: null };
    const upper = body.toUpperCase();

    const hardNarration = /(?:(?:\b(?:IMPS|NEFT|RTGS|ACH|ECS|NACH|UPI)\b[\s/:.-]{0,4})|\bAT\s{1,4}|@)$/;
    const softNarration = /(?:(?:\bVIA\b[\s:]{0,4})|\b(?:FROM|TO)\s{1,4})$/;
    const accountContext = /\b(?:BANK|CARD|A\/C|AC|ACCT|ACCOUNT|WALLET|RD|FD|POLICY|CREDIT|DEBIT)\b/;

    let mentioned: Institution | null = null;

    for (const item of aliasIndex) {
      item.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = item.regex.exec(upper)) !== null) {
        const start = match.index;
        const preceding = upper.substring(Math.max(0, start - 16), start);

        if (hardNarration.test(preceding)) continue;

        const windowStart = start + match[0].length;
        const trailing = upper.substring(windowStart, Math.min(upper.length, windowStart + 32));

        if (accountContext.test(trailing)) {
          return { own: item.institution, mentioned };
        }

        if (softNarration.test(preceding)) continue;

        if (item.patternHasBank && !mentioned) {
          mentioned = item.institution;
        }
      }
    }

    return { own: null, mentioned };
  },
};
