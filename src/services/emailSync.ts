/**
 * Financial Email Sync Service (Gmail API + Offline .EML / Statement Importer)
 * 
 * Secure, 100% client-side privacy:
 * - Direct connection to official Google Gmail REST API (read-only financial messages).
 * - No third-party servers or middleware; access tokens stay locally in memory.
 * - Supports offline .eml file parsing for air-gapped statement imports.
 */

import { Transaction } from '../types';
import { parseFinancialEmail, ParsedFinancialEmail } from '../utils/emailParser';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GMAIL_TOKEN_STORAGE_KEY = 'expense_diary_gmail_token';
const GMAIL_TOKEN_EXPIRY_KEY = 'expense_diary_gmail_token_exp';
const DEFAULT_CLIENT_ID_KEY = 'expense_diary_google_client_id';

// Default financial query to fetch strictly banking, NPS, salary & MF messages
const FINANCIAL_GMAIL_QUERY =
  'from:(cra-nsdl.com OR proteantech.in OR camsonline.com OR kfintech.com OR sbi.co.in OR hdfcbank.net OR icicibank.com OR axisbank.com) OR subject:(NPS OR PRAN OR contribution OR "salary slip" OR "salary credit" OR "units allotted" OR SIP)';

export interface EmailSyncResult {
  success: boolean;
  totalEmailsScanned: number;
  newTransactions: Transaction[];
  duplicatesSkipped: number;
  totalAmountExtracted: number;
  identifiedSenders: string[];
  error?: string;
}

export const EmailSyncService = {
  /**
   * Check if Gmail access token is currently valid
   */
  hasValidGmailToken(): boolean {
    const token = sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY);
    const exp = sessionStorage.getItem(GMAIL_TOKEN_EXPIRY_KEY);
    if (!token || !exp) return false;
    return Date.now() < parseInt(exp, 10);
  },

  /**
   * Get configured Google OAuth Client ID or stored default
   */
  getGoogleClientId(): string {
    return localStorage.getItem(DEFAULT_CLIENT_ID_KEY) || '';
  },

  /**
   * Set Google OAuth Client ID
   */
  setGoogleClientId(clientId: string): void {
    localStorage.setItem(DEFAULT_CLIENT_ID_KEY, clientId.trim());
  },

  /**
   * Load Google Identity Services SDK script dynamically if not present
   */
  async loadGoogleSdk(): Promise<boolean> {
    if (window.google?.accounts?.oauth2) return true;

    return new Promise((resolve) => {
      const existingScript = document.getElementById('google-gsi-script');
      if (existingScript) {
        existingScript.onload = () => resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  },

  /**
   * Request Google OAuth2 Access Token using 1-Tap GIS popup
   */
  async requestGmailAccessToken(clientIdOverride?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const clientId = clientIdOverride || this.getGoogleClientId();
    if (!clientId) {
      return {
        success: false,
        error: 'Google Client ID is required. You can provide your OAuth Client ID or import .eml files directly.',
      };
    }

    const sdkLoaded = await this.loadGoogleSdk();
    if (!sdkLoaded || !window.google?.accounts?.oauth2) {
      return { success: false, error: 'Failed to load Google Identity Services SDK.' };
    }

    return new Promise((resolve) => {
      try {
        const client = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          callback: (res) => {
            if (res.access_token) {
              const expiresInMs = 3500 * 1000;
              sessionStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, res.access_token);
              sessionStorage.setItem(GMAIL_TOKEN_EXPIRY_KEY, (Date.now() + expiresInMs).toString());
              resolve({ success: true, token: res.access_token });
            } else {
              resolve({ success: false, error: res.error || 'User cancelled permission request.' });
            }
          },
        });
        client.requestAccessToken();
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'OAuth initialization error.' });
      }
    });
  },

  /**
   * Disconnect & Clear Gmail token
   */
  disconnect(): void {
    sessionStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(GMAIL_TOKEN_EXPIRY_KEY);
  },

  /**
   * Decode Base64URL string (used by Gmail API message payloads)
   */
  decodeBase64Url(base64Url: string): string {
    try {
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(base64);
      return decodeURIComponent(
        decoded
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      try {
        return atob(base64Url.replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        return '';
      }
    }
  },

  /**
   * Extract plain text content from recursive Gmail payload parts
   */
  extractTextFromPayload(payload: any): string {
    if (!payload) return '';
    if (payload.body && payload.body.data) {
      const text = this.decodeBase64Url(payload.body.data);
      if (payload.mimeType === 'text/plain') return text;
      // Strip html tags if html
      return text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      let combined = '';
      for (const part of payload.parts) {
        combined += this.extractTextFromPayload(part) + '\n';
      }
      return combined.trim();
    }

    return '';
  },

  /**
   * Fetch and sync financial emails via Gmail REST API
   */
  async syncFinancialEmailsFromGmail(
    existingTransactions: Transaction[] = [],
    maxResults: number = 30
  ): Promise<EmailSyncResult> {
    const token = sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY);
    if (!token || !this.hasValidGmailToken()) {
      return {
        success: false,
        totalEmailsScanned: 0,
        newTransactions: [],
        duplicatesSkipped: 0,
        totalAmountExtracted: 0,
        identifiedSenders: [],
        error: 'Gmail session expired or not authenticated. Please authorize Gmail access.',
      };
    }

    try {
      // 1. Query messages
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
        FINANCIAL_GMAIL_QUERY
      )}&maxResults=${maxResults}`;

      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!listRes.ok) {
        if (listRes.status === 401) {
          this.disconnect();
          return {
            success: false,
            totalEmailsScanned: 0,
            newTransactions: [],
            duplicatesSkipped: 0,
            totalAmountExtracted: 0,
            identifiedSenders: [],
            error: 'Authentication failed (401). Token expired. Please reconnect.',
          };
        }
        throw new Error(`Gmail API error: ${listRes.statusText}`);
      }

      const listData = await listRes.json();
      const messageHeaders = listData.messages || [];

      if (messageHeaders.length === 0) {
        return {
          success: true,
          totalEmailsScanned: 0,
          newTransactions: [],
          duplicatesSkipped: 0,
          totalAmountExtracted: 0,
          identifiedSenders: [],
        };
      }

      // Existing deduplication maps
      const existingRefs = new Set(
        existingTransactions.map((t) => t.referenceNumber).filter(Boolean)
      );
      const existingEvidences = new Set(
        existingTransactions.map((t) => (t.evidence || '').substring(0, 80))
      );

      const newTransactions: Transaction[] = [];
      const sendersSet = new Set<string>();
      let duplicatesSkipped = 0;
      let totalAmountExtracted = 0;

      // 2. Fetch details for each message
      for (const item of messageHeaders) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!msgRes.ok) continue;
        const msg = await msgRes.json();

        // Extract headers
        const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '';
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
        const internalDate = parseInt(msg.internalDate || '0', 10);

        const body = this.extractTextFromPayload(msg.payload);
        const parsed = parseFinancialEmail(subject, body, from, internalDate);

        if (parsed) {
          sendersSet.add(parsed.sender);

          // Deduplication check
          const isDuplicate =
            (parsed.referenceNumber && existingRefs.has(parsed.referenceNumber)) ||
            existingEvidences.has(parsed.evidence.substring(0, 80));

          if (isDuplicate) {
            duplicatesSkipped++;
            continue;
          }

          if (parsed.referenceNumber) existingRefs.add(parsed.referenceNumber);
          existingEvidences.add(parsed.evidence.substring(0, 80));

          totalAmountExtracted += parsed.amount;

          const txn: Transaction = {
            id: parsed.id,
            type: parsed.type,
            amount: parsed.amount,
            title: parsed.title,
            category: parsed.category,
            date: parsed.date,
            time: parsed.time,
            vendorOrPerson: parsed.vendorOrPerson,
            paymentMode: 'Direct Transfer',
            notes: parsed.accountInfo ? `${parsed.sender} (${parsed.accountInfo})` : parsed.sender,
            isAiGenerated: true,
            needsConfirmation: false,
            evidence: parsed.evidence,
            evidenceSource: 'email',
            evidenceSender: parsed.sender,
            referenceNumber: parsed.referenceNumber,
            updatedAt: new Date().toISOString(),
          };

          newTransactions.push(txn);
        }
      }

      return {
        success: true,
        totalEmailsScanned: messageHeaders.length,
        newTransactions,
        duplicatesSkipped,
        totalAmountExtracted,
        identifiedSenders: Array.from(sendersSet),
      };
    } catch (err: any) {
      return {
        success: false,
        totalEmailsScanned: 0,
        newTransactions: [],
        duplicatesSkipped: 0,
        totalAmountExtracted: 0,
        identifiedSenders: [],
        error: err.message || 'Error scanning Gmail messages.',
      };
    }
  },

  /**
   * Parse raw .EML or text file offline without signing in
   */
  /**
   * Parse raw .EML, .MBOX database, or text file offline without signing in
   */
  async parseEmlFile(
    fileContent: string,
    fileName: string = 'statement.eml',
    existingTransactions: Transaction[] = []
  ): Promise<EmailSyncResult> {
    try {
      // Check if file is an .mbox database containing multiple emails
      const isMbox = fileName.toLowerCase().endsWith('.mbox') || /^From\s+[^\r\n]+/m.test(fileContent);
      const emailBlocks: string[] = isMbox
        ? fileContent.split(/(?:^|\r?\n)(?=From\s+[^\r\n]+)/g).map((b) => b.trim()).filter(Boolean)
        : [fileContent];

      const newTransactions: Transaction[] = [];
      let duplicatesSkipped = 0;
      let totalAmountExtracted = 0;
      const sendersSet = new Set<string>();

      for (const block of emailBlocks) {
        // Simple MIME/Header extractor
        const headerBodySplit = block.split(/\r?\n\r?\n/);
        const rawHeaders = headerBodySplit[0] || '';
        const body = headerBodySplit.slice(1).join('\n') || block;

        let subject = '';
        let from = '';
        let dateStr = '';

        const subMatch = rawHeaders.match(/^Subject:\s*(.*)$/im);
        if (subMatch) subject = subMatch[1].trim();

        const fromMatch = rawHeaders.match(/^From:\s*(.*)$/im);
        if (fromMatch) from = fromMatch[1].trim();

        const dateMatch = rawHeaders.match(/^Date:\s*(.*)$/im);
        if (dateMatch) dateStr = dateMatch[1].trim();

        const timestamp = dateStr && !isNaN(new Date(dateStr).getTime()) ? new Date(dateStr).getTime() : Date.now();
        const parsed = parseFinancialEmail(subject || fileName, body, from, timestamp);

        if (!parsed) continue;

        sendersSet.add(parsed.sender);

        const isDuplicate =
          existingTransactions.some(
            (t) =>
              (parsed.referenceNumber && t.referenceNumber === parsed.referenceNumber) ||
              (t.amount === parsed.amount && t.date === parsed.date && t.title === parsed.title)
          ) ||
          newTransactions.some(
            (t) =>
              (parsed.referenceNumber && t.referenceNumber === parsed.referenceNumber) ||
              (t.amount === parsed.amount && t.date === parsed.date && t.title === parsed.title)
          );

        if (isDuplicate) {
          duplicatesSkipped++;
          continue;
        }

        const txn: Transaction = {
          id: parsed.id,
          type: parsed.type,
          amount: parsed.amount,
          title: parsed.title,
          category: parsed.category,
          date: parsed.date,
          time: parsed.time,
          vendorOrPerson: parsed.vendorOrPerson,
          paymentMode: 'Direct Transfer',
          notes: parsed.accountInfo ? `${parsed.sender} (${parsed.accountInfo})` : parsed.sender,
          isAiGenerated: true,
          needsConfirmation: false,
          evidence: parsed.evidence,
          evidenceSource: 'email',
          evidenceSender: parsed.sender,
          referenceNumber: parsed.referenceNumber,
          updatedAt: new Date().toISOString(),
        };

        newTransactions.push(txn);
        totalAmountExtracted += txn.amount;
      }

      if (newTransactions.length === 0 && duplicatesSkipped === 0) {
        return {
          success: false,
          totalEmailsScanned: emailBlocks.length,
          newTransactions: [],
          duplicatesSkipped: 0,
          totalAmountExtracted: 0,
          identifiedSenders: Array.from(sendersSet),
          error: `Scanned ${emailBlocks.length} email(s), but no valid financial transactions (NPS, Salary, Bank debit/credit) were found.`,
        };
      }

      return {
        success: true,
        totalEmailsScanned: emailBlocks.length,
        newTransactions,
        duplicatesSkipped,
        totalAmountExtracted,
        identifiedSenders: Array.from(sendersSet),
      };
    } catch (err: any) {
      return {
        success: false,
        totalEmailsScanned: 0,
        newTransactions: [],
        duplicatesSkipped: 0,
        totalAmountExtracted: 0,
        identifiedSenders: [],
        error: err.message || 'Failed to read email database file.',
      };
    }
  },
};
