import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} folder - The folder path in storage (e.g., 'designs', 'updates')
 * @param {string} userId - The user ID for organizing files
 * @returns {Promise<{url: string, path: string}>} - Download URL and storage path
 */
export async function uploadFile(file, folder, userId) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Create a unique filename with timestamp
  const timestamp = Date.now();
  const filename = `${userId}/${timestamp}_${file.name}`;
  const storagePath = `${folder}/${filename}`;

  // Create storage reference
  const storageRef = ref(storage, storagePath);

  try {
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      url: downloadURL,
      path: storagePath,
      name: file.name,
      size: file.size,
      type: file.type
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Delete a file from Firebase Storage
 * @param {string} storagePath - The path of the file in storage
 */
export async function deleteFile(storagePath) {
  if (!storagePath) {
    throw new Error('No storage path provided');
  }

  const storageRef = ref(storage, storagePath);

  try {
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Upload multiple files
 * @param {File[]} files - Array of files to upload
 * @param {string} folder - The folder path in storage
 * @param {string} userId - The user ID for organizing files
 * @returns {Promise<Array>} - Array of upload results
 */
export async function uploadMultipleFiles(files, folder, userId) {
  const uploadPromises = files.map(file => uploadFile(file, folder, userId));
  return Promise.all(uploadPromises);
}
