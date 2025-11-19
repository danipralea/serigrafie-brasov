import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Result returned from file upload operations
 */
export interface UploadResult {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param folder - The folder path in storage (e.g., 'designs', 'updates')
 * @param userId - The user ID for organizing files
 * @returns Download URL and storage path information
 */
export async function uploadFile(
  file: File,
  folder: string,
  userId: string
): Promise<UploadResult> {
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
    if (import.meta.env.DEV) {
      console.error('Error uploading file:', error);
    }
    throw new Error('Failed to upload file');
  }
}

/**
 * Delete a file from Firebase Storage
 * @param storagePath - The path of the file in storage
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!storagePath) {
    throw new Error('No storage path provided');
  }

  const storageRef = ref(storage, storagePath);

  try {
    await deleteObject(storageRef);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error deleting file:', error);
    }
    throw new Error('Failed to delete file');
  }
}

/**
 * Upload multiple files
 * @param files - Array of files to upload
 * @param folder - The folder path in storage
 * @param userId - The user ID for organizing files
 * @returns Array of upload results
 */
export async function uploadMultipleFiles(
  files: File[],
  folder: string,
  userId: string
): Promise<UploadResult[]> {
  const uploadPromises = files.map(file => uploadFile(file, folder, userId));
  return Promise.all(uploadPromises);
}
