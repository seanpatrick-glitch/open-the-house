// OrgLogoUpload.jsx — reusable organization logo upload control.
// Uploads directly to Storage at organizations/{orgId}/logo/{filename}
// (see storage.rules, admin/secondaryAdmin write only, image content
// types under 5MB) and writes the resulting download URL to the org
// document's logoUrl field via updateDoc. Shared by SettingsView.jsx's
// Organization card and the onboarding wizard's Org step, so both
// surfaces use one upload flow instead of duplicating it.

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import toast from 'react-hot-toast';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // matches storage.rules' underSizeLimit()

export default function OrgLogoUpload({ orgId, logoUrl, onLogoChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Image must be smaller than 5MB.');
      return;
    }

    setUploading(true);
    try {
      const fileRef = ref(storage, `organizations/${orgId}/logo/${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'organizations', orgId), { logoUrl: url });
      onLogoChange?.(url);
    } catch (err) {
      console.error('OrgLogoUpload upload error:', err);
      toast.error(`Could not upload logo (${err.code || 'unknown error'}). Please try again.`);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await updateDoc(doc(db, 'organizations', orgId), { logoUrl: null });
      onLogoChange?.(null);
    } catch (err) {
      console.error('OrgLogoUpload remove error:', err);
      toast.error(`Could not remove logo (${err.code || 'unknown error'}). Please try again.`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Organization logo"
          className="h-16 w-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
        />
      ) : (
        <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
          No logo
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium text-places-blue hover:text-places-blue/90 disabled:opacity-50 transition-colors text-left"
        >
          {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="text-sm font-medium text-gray-500 hover:text-red-600 disabled:opacity-50 transition-colors text-left"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
