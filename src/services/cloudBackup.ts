// Modular Zero-Knowledge Cloud Backup Service
// Data is ALWAYS encrypted on-device with AES-GCM-256 before any network transmission.
// The user's PIN, 12-word passphrase, or keys NEVER leave the device.

import { EncryptedBackupEnvelope } from './encryption';

export interface CloudBackupMetadata {
  id: string;
  timestamp: string;
  sizeBytes: number;
  appVersion: string;
  deviceName?: string;
}

export interface ICloudBackupProvider {
  id: string;
  name: string;
  isConnected: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  uploadEncryptedBackup: (envelope: EncryptedBackupEnvelope) => Promise<{ success: boolean; backupId: string }>;
  listBackups: () => Promise<CloudBackupMetadata[]>;
  downloadEncryptedBackup: (backupId: string) => Promise<EncryptedBackupEnvelope>;
  deleteBackup: (backupId: string) => Promise<boolean>;
}

// Local mock / pluggable cloud provider adhering strictly to Zero-Knowledge principles
class LocalEncryptedCloudProvider implements ICloudBackupProvider {
  id = 'local-storage-cloud-sandbox';
  name = 'Secure Cloud Vault (Zero-Knowledge)';
  isConnected = true;

  private storageKey = 'ed_cloud_vault_backups_v2';

  async connect(): Promise<boolean> {
    this.isConnected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async uploadEncryptedBackup(envelope: EncryptedBackupEnvelope): Promise<{ success: boolean; backupId: string }> {
    // Verify that the payload is strictly an encrypted envelope
    if (envelope.magic !== 'EDBAES256' || !envelope.ciphertext) {
      throw new Error('SECURITY VIOLATION: Refusing to upload unencrypted payload to cloud.');
    }

    const backupId = `cloud-bk-${Date.now()}`;
    const item: { id: string; envelope: EncryptedBackupEnvelope; createdAt: string } = {
      id: backupId,
      envelope,
      createdAt: new Date().toISOString(),
    };

    const existing = this.getAllStored();
    existing.unshift(item);
    // Keep max 5 most recent cloud snapshots
    const trimmed = existing.slice(0, 5);
    localStorage.setItem(this.storageKey, JSON.stringify(trimmed));

    return { success: true, backupId };
  }

  async listBackups(): Promise<CloudBackupMetadata[]> {
    const items = this.getAllStored();
    return items.map((i) => ({
      id: i.id,
      timestamp: i.createdAt,
      sizeBytes: JSON.stringify(i.envelope).length,
      appVersion: i.envelope.appVersion || '1.0.0',
      deviceName: 'This Device (Secure Vault)',
    }));
  }

  async downloadEncryptedBackup(backupId: string): Promise<EncryptedBackupEnvelope> {
    const items = this.getAllStored();
    const found = items.find((i) => i.id === backupId);
    if (!found) {
      throw new Error(`Cloud backup ${backupId} not found.`);
    }
    return found.envelope;
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    const items = this.getAllStored();
    const filtered = items.filter((i) => i.id !== backupId);
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    return true;
  }

  private getAllStored(): Array<{ id: string; envelope: EncryptedBackupEnvelope; createdAt: string }> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance ready for UI or custom backend configuration
export const defaultCloudProvider: ICloudBackupProvider = new LocalEncryptedCloudProvider();
