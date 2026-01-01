const FOLDER_NAME = "Harp Music Library";
const METADATA_FILE_NAME = "library.json";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
}


interface DriveListResponse {
  files?: DriveFile[];
}

interface DriveUploadResponse {
  id: string;
  name?: string;
  mimeType?: string;
}

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

// Helper: Wrapper to handle 401 Unauthorized globally
async function fetchWithAuth(url: string, options: RequestInit, triggerAuthError = false): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 401) {
    console.warn("Session expired (401). Attempting quiet revalidation...");

    try {
      const getDriveTokenFn = httpsCallable<{ accessToken: string }>(functions, 'getDriveToken');
      const result = await getDriveTokenFn();
      const newAccessToken = (result.data as any).accessToken;

      if (newAccessToken) {
        console.log("Quiet revalidation successful. Retrying request...");

        // Dispatch event to update Context
        window.dispatchEvent(new CustomEvent("harp-token-refreshed", { detail: newAccessToken }));

        // Update the headers in the options object for the retry
        const newOptions = { ...options };
        newOptions.headers = {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };

        return await fetch(url, newOptions);
      }
    } catch (e) {
      console.error("Quiet revalidation failed:", e);
    }

    if (triggerAuthError) {
      console.log("Dispatching expiry event.");
      window.dispatchEvent(new Event("harp-session-expired"));
    }
    throw new Error("SESSION_EXPIRED");
  }
  return response;
}

// ... internal helpers ...
// Helper to find a file by name and parent
async function findFile(
  accessToken: string,
  name: string,
  parentId?: string,
  triggerAuthError = false
): Promise<DriveFile | null> {
  let query = `name = '${name}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id, name, mimeType, md5Checksum)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    triggerAuthError
  );

  const data: DriveListResponse = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// Helper to create a folder
async function createFolder(
  accessToken: string,
  name: string,
  triggerAuthError = false
): Promise<string> {
  const metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
  };

  const response = await fetchWithAuth(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
    triggerAuthError
  );

  const data: DriveFile = await response.json();
  return data.id;
}

// Robust Multipart Upload
async function uploadFile(
  accessToken: string,
  file: File | Blob,
  name: string,
  parentId: string,
  mimeType: string,
  triggerAuthError = false
): Promise<string> {
  const metadata = {
    name: name,
    parents: [parentId],
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  const response = await fetchWithAuth(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
    triggerAuthError
  );

  const data: DriveUploadResponse = await response.json();
  return data.id;
}

// Update an existing file (for library.json)
async function updateFile(
  accessToken: string,
  fileId: string,
  content: string,
  triggerAuthError = false
): Promise<void> {
  await fetchWithAuth(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: content,
    },
    triggerAuthError
  );
}

// Update file metadata (rename, etc.)
async function updateFileMetadata(
  accessToken: string,
  fileId: string,
  metadata: { name?: string },
  triggerAuthError = false
): Promise<void> {
  await fetchWithAuth(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
    triggerAuthError
  );
}

// --- Public Methods ---

export const DriveApiServices = {
  // Ensure the "Harp Music Library" folder exists
  async initLibraryFolder(accessToken: string, triggerAuthError = false): Promise<string> {
    const folder = await findFile(accessToken, FOLDER_NAME, undefined, triggerAuthError);
    if (!folder) {
      console.log("Creating Harp Library Folder...");
      const id = await createFolder(accessToken, FOLDER_NAME, triggerAuthError);
      return id;
    }
    return folder.id;
  },

  // Upload an asset
  async uploadAsset(
    accessToken: string,
    folderId: string,
    file: File | Blob,
    triggerAuthError = false
  ): Promise<string> {
    const fileName = file instanceof File ? file.name : "blob";
    return await uploadFile(accessToken, file, fileName, folderId, file.type, triggerAuthError);
  },

  // NEW: Get Metadata (e.g. hash)
  async getLibraryMetadata(
    accessToken: string,
    folderId: string,
    triggerAuthError = false
  ): Promise<DriveFile | null> {
    return await findFile(accessToken, METADATA_FILE_NAME, folderId, triggerAuthError);
  },

  // NEW: Download a file as Blob (for restoring backup)
  async downloadFile(accessToken: string, fileId: string, triggerAuthError = false): Promise<Blob> {
    const response = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      triggerAuthError
    );
    if (!response.ok) throw new Error(`Failed to download file ${fileId}`);
    return await response.blob();
  },

  // Fetch or Create the library.json index
  async getRemoteLibraryIndex<T>(
    accessToken: string,
    folderId: string,
    defaultContent: T,
    triggerAuthError = false
  ): Promise<T> {
    const file = await findFile(accessToken, METADATA_FILE_NAME, folderId, triggerAuthError);

    if (!file) {
      const blob = new Blob([JSON.stringify(defaultContent)], {
        type: "application/json",
      });
      await uploadFile(
        accessToken,
        blob,
        METADATA_FILE_NAME,
        folderId,
        "application/json",
        triggerAuthError
      );
      return defaultContent;
    }

    const response = await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      triggerAuthError
    );

    return (await response.json()) as T;
  },

  // Update the library.json index
  async updateRemoteLibraryIndex<T>(
    accessToken: string,
    folderId: string,
    newLibrary: T,
    triggerAuthError = false
  ) {
    const file = await findFile(accessToken, METADATA_FILE_NAME, folderId, triggerAuthError);
    if (file) {
      await updateFile(accessToken, file.id, JSON.stringify(newLibrary), triggerAuthError);
    }
  },

  // Revoke the access token (Cleanup)
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `token=${accessToken}`,
      });
      console.log("Token revoked successfully");
    } catch (e) {
      console.warn("Failed to revoke token", e);
    }
  },

  // Delete a file permanently
  async deleteFile(accessToken: string, fileId: string, triggerAuthError = false): Promise<void> {
    await fetchWithAuth(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      triggerAuthError
    );
  },

  // Update File Metadata (Rename)
  async updateFileMetadata(
    accessToken: string,
    fileId: string,
    metadata: { name?: string },
    triggerAuthError = false
  ) {
    await updateFileMetadata(accessToken, fileId, metadata, triggerAuthError);
  },
};
