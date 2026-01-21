/**
 * Utilitaires pour la gestion des dossiers
 */

import type { Folder } from '../types/folder';
import { getFolderById } from '../mocks/folders';

export interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

/**
 * Calcule le chemin complet (breadcrumb) depuis la racine jusqu'au dossier donné
 * @param folderId - ID du dossier courant
 * @returns Array de BreadcrumbItem depuis root jusqu'au dossier courant
 *
 * @example
 * // Pour dossier: "Work/Projects/2024"
 * getBreadcrumbPath('sub-1-1-1')
 * // Retourne: [
 * //   { id: '1', name: 'Work', path: '/folder/1' },
 * //   { id: 'sub-1-1', name: 'Projects', path: '/folder/sub-1-1' },
 * //   { id: 'sub-1-1-1', name: '2024', path: '/folder/sub-1-1-1' }
 * // ]
 */
export const getBreadcrumbPath = (folderId: string): BreadcrumbItem[] => {
  const path: BreadcrumbItem[] = [];
  let currentFolder = getFolderById(folderId);

  // Remonter récursivement jusqu'à la racine
  while (currentFolder) {
    path.unshift({
      id: currentFolder.id,
      name: currentFolder.name,
      path: `/folder/${currentFolder.id}`
    });

    if (currentFolder.parentFolderId) {
      currentFolder = getFolderById(currentFolder.parentFolderId);
    } else {
      // Atteint la racine
      break;
    }
  }

  return path;
};

/**
 * Calcule le chemin complet (array de dossiers) depuis la racine
 * @param folderId - ID du dossier courant
 * @returns Array de Folder depuis root jusqu'au dossier courant
 */
export const getFolderPath = (folderId: string): Folder[] => {
  const path: Folder[] = [];
  let current = getFolderById(folderId);

  while (current) {
    path.unshift(current);
    current = current.parentFolderId
      ? getFolderById(current.parentFolderId)
      : undefined;
  }

  return path;
};

/**
 * Vérifie si un dossier est un ancêtre d'un autre
 * @param ancestorId - ID du dossier ancêtre potentiel
 * @param descendantId - ID du dossier descendant potentiel
 * @returns true si ancestorId est un ancêtre de descendantId
 */
export const isAncestor = (ancestorId: string, descendantId: string): boolean => {
  let current = getFolderById(descendantId);

  while (current) {
    if (current.id === ancestorId) {
      return true;
    }

    if (current.parentFolderId) {
      current = getFolderById(current.parentFolderId);
    } else {
      break;
    }
  }

  return false;
};

/**
 * Calcule la profondeur d'un dossier (nombre de niveaux depuis la racine)
 * @param folderId - ID du dossier
 * @returns Profondeur (0 pour root, 1 pour sous-dossier direct, etc.)
 */
export const getFolderDepth = (folderId: string): number => {
  let depth = 0;
  let current = getFolderById(folderId);

  while (current && current.parentFolderId) {
    depth++;
    current = getFolderById(current.parentFolderId);
  }

  return depth;
};

/**
 * Génère un chemin textuel pour affichage
 * @param folderId - ID du dossier
 * @returns Chemin sous forme "Work/Projects/2024"
 */
export const getFolderPathString = (folderId: string): string => {
  const path = getFolderPath(folderId);
  return path.map(f => f.name).join(' / ');
};
