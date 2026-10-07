// src/firebase/database.ts
// Central Firebase Realtime Database reference helpers
import {
  ref,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  off,
  query,
  limitToLast,
  orderByKey,
  DataSnapshot,
  set,
  update,
  remove,
  get,
  push,
} from 'firebase/database';
import database from './config';

// Helper to create database references
export const dbRef = (path: string) => ref(database, path);

// Helper to create limited queries for events
export const dbQuery = (path: string, limit: number) =>
  query(ref(database, path), orderByKey(), limitToLast(limit));

// Re-export Firebase listener and mutation functions for convenience
export {
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  off,
  ref,
  query,
  limitToLast,
  orderByKey,
  set,
  update,
  remove,
  get,
  push,
};
export type { DataSnapshot };
export default database;
