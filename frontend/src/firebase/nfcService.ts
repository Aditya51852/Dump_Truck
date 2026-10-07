// src/firebase/nfcService.ts
import { ref, onValue, off, set, remove, update } from 'firebase/database';
import database from './config';
import type { NfcCard } from '../types';

type NfcCardsCallback = (cards: Record<string, NfcCard>) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to NFC cards in real-time
 */
export function subscribeToNfcCards(
  onData: NfcCardsCallback,
  onError?: ErrorCallback
): () => void {
  const nfcRef = ref(database, 'nfc_cards');

  onValue(
    nfcRef,
    (snapshot) => {
      const rawData = snapshot.val() || {};
      const normalizedCards: Record<string, NfcCard> = {};

      Object.entries(rawData).forEach(([cardId, val]) => {
        if (typeof val === 'string') {
          normalizedCards[cardId] = { driverId: val, enabled: true };
        } else if (val && typeof val === 'object') {
          const cardObj = val as Record<string, unknown>;
          normalizedCards[cardId] = {
            driverId: (cardObj.driverId as string) || '',
            enabled: cardObj.enabled !== false,
            cardName: (cardObj.cardName as string) || undefined,
            notes: (cardObj.notes as string) || undefined,
            issuedDate: (cardObj.issuedDate as string) || undefined,
            updatedAt: (cardObj.updatedAt as string) || undefined,
          };
        }
      });

      onData(normalizedCards);
    },
    (error) => {
      if (onError) onError(error);
    }
  );

  return () => off(nfcRef);
}

/**
 * Add or update an NFC card mapping directly on Firebase
 * Path: nfc_cards/{cardId}
 */
export async function addOrUpdateNfcCard(
  cardId: string,
  cardData: {
    driverId: string;
    enabled?: boolean;
    cardName?: string;
    notes?: string;
  }
): Promise<void> {
  const cleanId = cardId.trim().toUpperCase();
  if (!cleanId) {
    throw new Error('NFC Card ID is required');
  }

  const cardRef = ref(database, `nfc_cards/${cleanId}`);
  const payload: Record<string, unknown> = {
    driverId: cardData.driverId.trim(),
    enabled: cardData.enabled !== false,
    updatedAt: new Date().toISOString(),
  };

  if (cardData.cardName?.trim()) {
    payload.cardName = cardData.cardName.trim();
  }
  if (cardData.notes?.trim()) {
    payload.notes = cardData.notes.trim();
  }

  await set(cardRef, payload);
}

/**
 * Toggle enable/disable status for an NFC card directly in Firebase
 */
export async function toggleNfcCardStatus(
  cardId: string,
  enabled: boolean
): Promise<void> {
  const cleanId = cardId.trim().toUpperCase();
  if (!cleanId) return;
  const cardRef = ref(database, `nfc_cards/${cleanId}`);
  await update(cardRef, {
    enabled,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete an NFC card mapping directly from Firebase
 */
export async function deleteNfcCard(cardId: string): Promise<void> {
  const cleanId = cardId.trim().toUpperCase();
  if (!cleanId) return;
  const cardRef = ref(database, `nfc_cards/${cleanId}`);
  await remove(cardRef);
}
