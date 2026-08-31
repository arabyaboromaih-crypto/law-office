/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Case, Client, Company, HearingSession, AuditLog, LegalTask } from './types';

// Operational data is stored securely in Firebase Firestore and external cloud storage.
// This file contains clean schema template arrays to ensure no sensitive operational data
// (clients, cases, owners, tenants, contracts, phones, financials) is committed to GitHub.

export const initialUsers: User[] = [];
export const initialClients: Client[] = [];
export const initialCompanies: Company[] = [];
export const initialCases: Case[] = [];
export const initialSessions: HearingSession[] = [];
export const initialLogs: AuditLog[] = [];
export const initialTasks: LegalTask[] = [];
