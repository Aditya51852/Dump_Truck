// src/hooks/useNfcCards.ts
import { useState, useEffect } from 'react';
import { subscribeToNfcCards } from '../firebase/nfcService';
import type { NfcCard } from '../types';

export interface NfcCardItem {
  id: string;
  driverId: string;
  enabled?: boolean;
  cardName?: string;
  notes?: string;
  updatedAt?: string;
}

interface UseNfcCardsReturn {
  cards: Record<string, NfcCard>;
  cardList: NfcCardItem[];
  loading: boolean;
  error: Error | null;
}

export function useNfcCards(): UseNfcCardsReturn {
  const [cards, setCards] = useState<Record<string, NfcCard>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToNfcCards(
      (data) => {
        setCards(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const cardList: NfcCardItem[] = Object.entries(cards).map(([id, card]) => ({
    id,
    driverId: card.driverId || '',
    enabled: card.enabled !== false,
    cardName: card.cardName,
    notes: card.notes,
    updatedAt: card.updatedAt,
  }));

  return { cards, cardList, loading, error };
}
