/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserPermissions, UserRole, User } from '../types';

/**
 * Generates default permissions according to user role.
 */
export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  const isAdmin = role === 'admin';
  const isLawyer = role === 'lawyer';
  const isSecretary = role === 'secretary';
  const isEmployee = role === 'employee';

  if (isAdmin) {
    return {
      // Cases
      viewCases: true, addCase: true, editCase: true, deleteCase: true, archiveCase: true, restoreCase: true, printCase: true,
      // Companies
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: true, archiveCompany: true, restoreCompany: true, printCompany: true,
      // Clients
      viewClients: true, addClient: true, editClient: true, deleteClient: true,
      // Sessions & Agenda
      viewAgenda: true, addSession: true, editSession: true, deleteSession: true, recordSessionDecision: true, editSessionDecision: true,
      // Real Estate
      viewRealEstate: true, addRealEstateProperty: true, editRealEstateProperty: true, deleteRealEstateProperty: true,
      addRealEstateContract: true, editRealEstateContract: true, collectRealEstateRent: true, rollbackRealEstateCollection: true,
      disburseOwnerPayment: true, manageOwnerAdvances: true, printRealEstateReports: true,
      // General Archive
      viewArchive: true,
      // Documents
      uploadDoc: true, downloadDoc: true, deleteDoc: true, printDoc: true,
      // Fees
      viewFees: true, addReceipt: true, editFees: true, deleteFees: true,
      // Reports
      viewReports: true, printReports: true, exportPdf: true, exportExcel: true,
      // System & Users & Backup
      manageUsers: true, manageSettings: true, backupSystemData: true, restoreSystemData: true,
      // Tasks
      viewTasks: true, addTask: true, editTask: true, deleteTask: true, assignTask: true, reassignTask: true,
      changeTaskStatus: true, sendTaskWhatsapp: true, viewAllTasks: true, viewOwnTasksOnly: false,
      approveTaskCompletion: true, reopenTask: true, manageTasks: true, viewUserTaskTracking: true, viewTaskExecutionTracking: true,
    };
  }

  if (isLawyer) {
    return {
      // Cases
      viewCases: true, addCase: true, editCase: true, deleteCase: false, archiveCase: true, restoreCase: false, printCase: true,
      // Companies
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: false, archiveCompany: true, restoreCompany: false, printCompany: true,
      // Clients
      viewClients: true, addClient: true, editClient: true, deleteClient: false,
      // Sessions & Agenda
      viewAgenda: true, addSession: true, editSession: true, deleteSession: false, recordSessionDecision: true, editSessionDecision: true,
      // Real Estate
      viewRealEstate: true, addRealEstateProperty: true, editRealEstateProperty: true, deleteRealEstateProperty: false,
      addRealEstateContract: true, editRealEstateContract: true, collectRealEstateRent: true, rollbackRealEstateCollection: false,
      disburseOwnerPayment: true, manageOwnerAdvances: true, printRealEstateReports: true,
      // General Archive
      viewArchive: true,
      // Documents
      uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
      // Fees
      viewFees: true, addReceipt: true, editFees: false, deleteFees: false,
      // Reports
      viewReports: true, printReports: true, exportPdf: true, exportExcel: true,
      // System & Users & Backup
      manageUsers: false, manageSettings: false, backupSystemData: false, restoreSystemData: false,
      // Tasks
      viewTasks: true, addTask: true, editTask: true, deleteTask: false, assignTask: true, reassignTask: true,
      changeTaskStatus: true, sendTaskWhatsapp: true, viewAllTasks: true, viewOwnTasksOnly: false,
      approveTaskCompletion: false, reopenTask: true, manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false,
    };
  }

  if (isSecretary) {
    return {
      // Cases
      viewCases: true, addCase: true, editCase: true, deleteCase: false, archiveCase: false, restoreCase: false, printCase: true,
      // Companies
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: false, archiveCompany: false, restoreCompany: false, printCompany: true,
      // Clients
      viewClients: true, addClient: true, editClient: true, deleteClient: false,
      // Sessions & Agenda
      viewAgenda: true, addSession: true, editSession: true, deleteSession: false, recordSessionDecision: true, editSessionDecision: true,
      // Real Estate
      viewRealEstate: true, addRealEstateProperty: true, editRealEstateProperty: true, deleteRealEstateProperty: false,
      addRealEstateContract: true, editRealEstateContract: false, collectRealEstateRent: true, rollbackRealEstateCollection: false,
      disburseOwnerPayment: false, manageOwnerAdvances: false, printRealEstateReports: true,
      // General Archive
      viewArchive: true,
      // Documents
      uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
      // Fees
      viewFees: true, addReceipt: true, editFees: false, deleteFees: false,
      // Reports
      viewReports: true, printReports: true, exportPdf: false, exportExcel: false,
      // System & Users & Backup
      manageUsers: false, manageSettings: false, backupSystemData: false, restoreSystemData: false,
      // Tasks
      viewTasks: true, addTask: true, editTask: true, deleteTask: false, assignTask: true, reassignTask: false,
      changeTaskStatus: true, sendTaskWhatsapp: true, viewAllTasks: true, viewOwnTasksOnly: false,
      approveTaskCompletion: false, reopenTask: false, manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false,
    };
  }

  // Employee (مستخدم عادي / مندوب)
  return {
    // Cases
    viewCases: true, addCase: false, editCase: false, deleteCase: false, archiveCase: false, restoreCase: false, printCase: true,
    // Companies
    viewCompanies: true, addCompany: false, editCompany: false, deleteCompany: false, archiveCompany: false, restoreCompany: false, printCompany: true,
    // Clients
    viewClients: true, addClient: true, editClient: false, deleteClient: false,
    // Sessions & Agenda
    viewAgenda: true, addSession: false, editSession: false, deleteSession: false, recordSessionDecision: true, editSessionDecision: false,
    // Real Estate
    viewRealEstate: true, addRealEstateProperty: false, editRealEstateProperty: false, deleteRealEstateProperty: false,
    addRealEstateContract: false, editRealEstateContract: false, collectRealEstateRent: true, rollbackRealEstateCollection: false,
    disburseOwnerPayment: false, manageOwnerAdvances: false, printRealEstateReports: false,
    // General Archive
    viewArchive: false,
    // Documents
    uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
    // Fees
    viewFees: false, addReceipt: false, editFees: false, deleteFees: false,
    // Reports
    viewReports: false, printReports: false, exportPdf: false, exportExcel: false,
    // System & Users & Backup
    manageUsers: false, manageSettings: false, backupSystemData: false, restoreSystemData: false,
    // Tasks
    viewTasks: true, addTask: false, editTask: false, deleteTask: false, assignTask: false, reassignTask: false,
    changeTaskStatus: true, sendTaskWhatsapp: true, viewAllTasks: false, viewOwnTasksOnly: true,
    approveTaskCompletion: false, reopenTask: false, manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false,
  };
}

/**
 * Normalizes user permissions object, preserving all existing set values,
 * and assigning default role values for any newly added permission keys.
 */
export function normalizePermissions(existingPerms?: Partial<UserPermissions>, role: UserRole = 'employee'): UserPermissions {
  const defaults = getDefaultPermissionsForRole(role);
  if (!existingPerms) return defaults;

  // Super Admin always gets true for all permissions
  if (role === 'admin') {
    const adminDefaults = getDefaultPermissionsForRole('admin');
    const result = { ...adminDefaults };
    // Maintain any explicitly false values if super admin ever revoked, but default to true
    Object.keys(adminDefaults).forEach((key) => {
      const k = key as keyof UserPermissions;
      if (existingPerms[k] !== undefined) {
        result[k] = existingPerms[k]!;
      }
    });
    return result;
  }

  const result: UserPermissions = { ...defaults };
  // Merge existing set values (never overwrite an explicitly defined boolean)
  (Object.keys(defaults) as (keyof UserPermissions)[]).forEach((key) => {
    if (existingPerms[key] !== undefined) {
      result[key] = Boolean(existingPerms[key]);
    }
  });

  return result;
}

/**
 * Creates a safety backup of current user permissions in localStorage and returns success.
 */
export function createPermissionsBackup(users: User[]): boolean {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      usersCount: users.length,
      users: users.map(u => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        permissions: u.permissions
      }))
    };
    const key = `romeih_permissions_backup_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(backupData));
    localStorage.setItem('romeih_latest_permissions_backup', JSON.stringify(backupData));
    return true;
  } catch (err) {
    console.error('Failed to create permissions backup:', err);
    return false;
  }
}
