/**
 * Free Cloud Database Real-Time Synchronization Service
 * 
 * Provides hybrid zero-knowledge encrypted cloud backups:
 * - Uses Firebase Firestore REST API or custom REST Cloud Key-Value store
 * - All payloads are client-side AES-GCM 256-bit encrypted before leaving device
 * - Zero-cost forever on Firebase Free Spark Tier
 * - Real-time sync alongside hidden local Android vault
 */

import { AppVaultData } from './vaultStorage';
import { encryptPayload, decryptPayload, EncryptedBackupEnvelope } from './encryption';

export interface CloudSyncConfig {
  enabled: boolean;
  provider: 'firebase' | 'custom';
  projectId: string; // Firebase Project ID
  apiKey?: string;    // Firebase Web API Key (optional for public Firestore rules)
  collectionName?: string;
  userSyncId?: string; // Derived hash or custom ID
  lastSyncedAt?: string;
  autoSync: boolean;
}

const STORAGE_KEY_CLOUD_CONFIG = 'smart_expense_cloud_config';
const DEFAULT_COLLECTION = 'smart_expense_vaults';

export const CloudSyncService = {
  /**
   * Get current cloud sync configuration
   */
  getConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLOUD_CONFIG);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return {
      enabled: false,
      provider: 'firebase',
      projectId: '',
      apiKey: '',
      collectionName: DEFAULT_COLLECTION,
      userSyncId: '',
      autoSync: true,
    };
  },

  /**
   * Save cloud sync configuration
   */
  saveConfig(config: Partial<CloudSyncConfig>): CloudSyncConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY_CLOUD_CONFIG, JSON.stringify(updated));
    return updated;
  },

  /**
   * Encrypt and upload entire vault to free cloud database
   */
  async uploadVaultToCloud(
    vault: AppVaultData,
    passphraseWords: string[]
  ): Promise<{ success: boolean; error?: string; syncedAt?: string }> {
    const config = this.getConfig();
    if (!config.enabled || !config.projectId?.trim()) {
      return { success: false, error: 'Cloud sync is not configured or enabled' };
    }

    if (!passphraseWords || passphraseWords.length < 12) {
      return { success: false, error: 'Valid 12 recovery words required to encrypt cloud backup' };
    }

    try {
      const passphrase = passphraseWords.join(' ').trim().toLowerCase();
      // Authenticated AES-GCM 256-bit encryption
      const encryptedEnvelope: EncryptedBackupEnvelope = await encryptPayload(vault, passphrase);

      const projectId = config.projectId.trim();
      const collection = config.collectionName?.trim() || DEFAULT_COLLECTION;
      const documentId = config.userSyncId?.trim() || 'my_primary_vault';

      // Firebase Firestore REST API endpoint
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${documentId}`;

      // Firestore REST requires typed document structure
      const firestoreDoc = {
        fields: {
          magic: { stringValue: encryptedEnvelope.magic },
          version: { stringValue: encryptedEnvelope.version },
          salt: { stringValue: encryptedEnvelope.salt },
          iv: { stringValue: encryptedEnvelope.iv },
          ciphertext: { stringValue: encryptedEnvelope.ciphertext },
          iterations: { integerValue: String(encryptedEnvelope.iterations) },
          kdf: { stringValue: encryptedEnvelope.kdf },
          exportedAt: { stringValue: encryptedEnvelope.exportedAt },
          appVersion: { stringValue: encryptedEnvelope.appVersion },
          transactionCount: { integerValue: String(vault.transactions?.length || 0) },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      };

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(firestoreDoc),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[CloudSync] Upload error:', response.status, errText);
        return {
          success: false,
          error: `Cloud server error (${response.status}): Check Project ID and Firestore rules.`,
        };
      }

      const syncedAt = new Date().toISOString();
      this.saveConfig({ lastSyncedAt: syncedAt });
      return { success: true, syncedAt };
    } catch (e: any) {
      console.error('[CloudSync] Sync exception:', e);
      return { success: false, error: e?.message || 'Network error connecting to cloud server' };
    }
  },

  /**
   * Fetch and decrypt vault from free cloud database
   */
  async downloadVaultFromCloud(
    passphraseWords: string[]
  ): Promise<{ success: boolean; vault?: AppVaultData; error?: string }> {
    const config = this.getConfig();
    if (!config.enabled || !config.projectId?.trim()) {
      return { success: false, error: 'Cloud sync is not configured or enabled' };
    }

    if (!passphraseWords || passphraseWords.length < 12) {
      return { success: false, error: 'Valid 12 recovery words required to decrypt cloud backup' };
    }

    try {
      const projectId = config.projectId.trim();
      const collection = config.collectionName?.trim() || DEFAULT_COLLECTION;
      const documentId = config.userSyncId?.trim() || 'my_primary_vault';

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${documentId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        return { success: false, error: 'No cloud backup document found in this project.' };
      }

      if (!response.ok) {
        return { success: false, error: `Failed to fetch from cloud (${response.status})` };
      }

      const data = await response.json();
      const fields = data.fields;
      if (!fields || !fields.ciphertext?.stringValue) {
        return { success: false, error: 'Corrupt or empty cloud backup document.' };
      }

      const envelope: EncryptedBackupEnvelope = {
        magic: fields.magic?.stringValue || 'EDBAES256',
        version: fields.version?.stringValue || '2.0.0',
        kdf: fields.kdf?.stringValue || 'PBKDF2-SHA256',
        iterations: parseInt(fields.iterations?.integerValue || '100000', 10),
        salt: fields.salt?.stringValue || '',
        iv: fields.iv?.stringValue || '',
        ciphertext: fields.ciphertext?.stringValue || '',
        exportedAt: fields.exportedAt?.stringValue || '',
        appVersion: fields.appVersion?.stringValue || '1.0.0',
      };

      const passphrase = passphraseWords.join(' ').trim().toLowerCase();
      const decryptedVault: AppVaultData = await decryptPayload(envelope, passphrase);

      return { success: true, vault: decryptedVault };
    } catch (e: any) {
      console.error('[CloudSync] Download exception:', e);
      return {
        success: false,
        error: e?.message || 'Decryption failed: Please ensure 12 recovery words are correct.',
      };
    }
  },

  /**
   * Test connection to Firebase project
   */
  async testConnection(projectId: string): Promise<{ ok: boolean; error?: string }> {
    if (!projectId?.trim()) {
      return { ok: false, error: 'Please enter a valid Firebase Project ID' };
    }
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId.trim()}/databases/(default)/documents`;
      const res = await fetch(url, { method: 'GET' });
      // 200 or 403/404 means the project exists and is reachable
      if (res.status === 200 || res.status === 403 || res.status === 404) {
        return { ok: true };
      }
      return { ok: false, error: `Server responded with status ${res.status}` };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Could not connect to project endpoint' };
    }
  },
};
