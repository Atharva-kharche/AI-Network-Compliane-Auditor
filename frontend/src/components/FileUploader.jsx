import { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadConfig } from '../services/api'

export default function FileUploader({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e) => {
    handleDrag(e)
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    handleDrag(e)
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    handleDrag(e)
    setIsDragging(false)
    const files = e.dataTransfer?.files
    if (files?.length) handleFile(files[0])
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files?.length) handleFile(files[0])
    e.target.value = '' // Reset for re-upload
  }

  const handleFile = async (file) => {
    const allowedExtensions = ['.txt', '.conf', '.cfg', '.json']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`)
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const result = await uploadConfig(file)
      setUploadResult(result)
      toast.success(result.message || 'Config uploaded successfully!')
      onUploadSuccess?.(result)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.'
      toast.error(msg)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div>
      <div
        className={`upload-zone${isDragging ? ' drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.conf,.cfg,.json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <>
            <div className="upload-zone-icon">
              <Loader size={28} className="animate-pulse" />
            </div>
            <div className="upload-zone-title">Uploading & Parsing…</div>
            <div className="upload-zone-subtitle">Detecting vendor and normalizing configuration</div>
          </>
        ) : (
          <>
            <div className="upload-zone-icon">
              <UploadCloud size={28} />
            </div>
            <div className="upload-zone-title">
              Drop config file here or <span style={{ color: 'var(--accent-light)' }}>browse</span>
            </div>
            <div className="upload-zone-subtitle">
              Supports .txt, .conf, .cfg, .json — Cisco, Palo Alto, Juniper, Arista, SONiC and more
            </div>
          </>
        )}
      </div>

      {uploadResult && (
        <div className="card mt-24" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div className="flex items-center gap-12 mb-16">
            <CheckCircle size={20} color="var(--color-success)" />
            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Upload Successful</span>
          </div>

          <div className="detail-grid" style={{ margin: 0 }}>
            <div className="detail-item">
              <label>Hostname</label>
              <span>{uploadResult.device?.hostname}</span>
            </div>
            <div className="detail-item">
              <label>Vendor</label>
              <span style={{ textTransform: 'capitalize' }}>{uploadResult.device?.vendor}</span>
            </div>
            <div className="detail-item">
              <label>Device Type</label>
              <span style={{ textTransform: 'capitalize' }}>{uploadResult.device?.device_type}</span>
            </div>
            <div className="detail-item">
              <label>Parse Status</label>
              <span className={`badge ${uploadResult.config_file?.parse_status === 'parsed' ? 'badge-pass' : 'badge-warning'}`}>
                {uploadResult.config_file?.parse_status}
              </span>
            </div>
            <div className="detail-item">
              <label>OS Version</label>
              <span>{uploadResult.device?.os_version}</span>
            </div>
            <div className="detail-item">
              <label>Filename</label>
              <span>{uploadResult.config_file?.filename}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
