// FileUploads.jsx — upload, view, and download files for each show

import React, { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, getDocs,
  deleteDoc, doc, orderBy, query,
} from 'firebase/firestore'
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage'
import { db, storage } from '../../firebase'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function FileUploads({ showId }) {
  const [files,          setFiles]          = useState([])
  const [uploading,      setUploading]      = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [zipping,        setZipping]        = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { loadFiles() }, [showId])

  async function loadFiles() {
    try {
      const q    = query(collection(db, 'shows', showId, 'files'), orderBy('uploadDate', 'desc'))
      const snap = await getDocs(q)
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Could not load files:', err)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)

    // Store under shows/{showId}/{timestamp}_{filename} to avoid name collisions
    const storagePath = `shows/${showId}/${Date.now()}_${file.name}`
    const storageRef  = ref(storage, storagePath)
    const uploadTask  = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (err) => {
        console.error(err)
        toast.error('Upload failed. Please try again.')
        setUploading(false)
      },
      async () => {
        // Upload complete — get the download URL and save metadata to Firestore
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
        const meta = {
          name:        file.name,
          uploadDate:  new Date().toISOString(),
          storagePath,
          downloadUrl,
          type:        file.type,
          size:        file.size,
        }
        const docRef = await addDoc(collection(db, 'shows', showId, 'files'), meta)
        setFiles(prev => [{ id: docRef.id, ...meta }, ...prev])
        toast.success(`"${file.name}" uploaded!`)
        setUploading(false)
        setUploadProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    )
  }

  async function handleDelete(fileId, storagePath, fileName) {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return
    try {
      await deleteObject(ref(storage, storagePath))
      await deleteDoc(doc(db, 'shows', showId, 'files', fileId))
      setFiles(prev => prev.filter(f => f.id !== fileId))
      toast.success(`"${fileName}" deleted.`)
    } catch (err) {
      console.error(err)
      toast.error('Could not delete file. Please try again.')
    }
  }

  async function handleDownloadAll() {
    if (files.length === 0) {
      toast.error('No files to download.')
      return
    }
    setZipping(true)
    toast('Preparing ZIP — this may take a moment…')

    try {
      const zip = new JSZip()

      // Fetch each file and add it to the ZIP
      await Promise.all(
        files.map(async (file) => {
          const response = await fetch(file.downloadUrl)
          const blob     = await response.blob()
          zip.file(file.name, blob) // preserve original file name
        })
      )

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `show-files.zip`)
      toast.success('ZIP downloaded — check your Downloads folder!')
    } catch (err) {
      console.error(err)
      toast.error('Could not create ZIP file.')
    }

    setZipping(false)
  }

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isImage = (type) => type && type.startsWith('image/')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          Files {files.length > 0 && <span className="text-gray-400 font-normal text-base">({files.length})</span>}
        </h2>
        {files.length > 0 && (
          <button onClick={handleDownloadAll} disabled={zipping}
            className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {zipping ? 'Preparing ZIP…' : `↓ Download All as ZIP`}
          </button>
        )}
      </div>

      {/* Upload drop zone */}
      <label htmlFor="file-upload"
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all mb-6 group">
        {uploading ? (
          <div className="text-center px-4">
            <div className="text-sm text-gray-600 mb-2 font-medium">Uploading… {uploadProgress}%</div>
            <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto">
              <div className="bg-amber-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-3xl mb-1">📎</div>
            <div className="text-sm font-medium text-gray-600 group-hover:text-amber-700 transition-colors">
              Click to upload a file
            </div>
            <div className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, and more</div>
          </div>
        )}
        <input id="file-upload" type="file" ref={fileInputRef}
          onChange={handleUpload} disabled={uploading} className="hidden" />
      </label>

      {/* File grid */}
      {files.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No files uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file) => (
            <div key={file.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
              {/* Thumbnail or icon */}
              <div className="h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
                {isImage(file.type) ? (
                  <img src={file.downloadUrl} alt={file.name}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <div className="text-2xl">📄</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase">
                      {file.name.split('.').pop() || 'file'}
                    </div>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-900 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(file.uploadDate)}
                  {file.size ? ` · ${formatSize(file.size)}` : ''}
                </p>
                <div className="flex gap-3 mt-2">
                  <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
                    Open
                  </a>
                  <button onClick={() => handleDelete(file.id, file.storagePath, file.name)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
