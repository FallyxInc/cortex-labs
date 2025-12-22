/**
 * Comment utilities for hydration residents
 * Handles localStorage operations for resident comments
 */

const STORAGE_KEY = "residentComments";

/**
 * Load saved comments from localStorage
 * @returns Record of resident names to comments
 */
export function loadSavedComments(): Record<string, string> {
  try {
    const savedComments = localStorage.getItem(STORAGE_KEY);
    if (savedComments) {
      return JSON.parse(savedComments);
    }
  } catch (error) {
    console.error("Error loading saved comments:", error);
  }
  return {};
}

/**
 * Save comments to localStorage
 * @param comments Record of resident names to comments
 */
export function saveCommentsToStorage(
  comments: Record<string, string>
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
  } catch (error) {
    console.error("Error saving comments to localStorage:", error);
  }
}

/**
 * Get comment for a specific resident
 * @param residentName Name of the resident
 * @param comments Record of all comments
 * @returns Comment string or empty string
 */
export function getComment(
  residentName: string,
  comments: Record<string, string>
): string {
  return comments[residentName] || "";
}

/**
 * Set comment for a resident in the comments object
 * @param residentName Name of the resident
 * @param comment Comment text
 * @param comments Current comments object
 * @returns New comments object with updated comment
 */
export function setComment(
  residentName: string,
  comment: string,
  comments: Record<string, string>
): Record<string, string> {
  return {
    ...comments,
    [residentName]: comment,
  };
}

/**
 * Delete comment for a resident
 * @param residentName Name of the resident
 * @param comments Current comments object
 * @returns New comments object without the deleted comment
 */
export function deleteComment(
  residentName: string,
  comments: Record<string, string>
): Record<string, string> {
  const newComments = { ...comments };
  delete newComments[residentName];
  return newComments;
}

