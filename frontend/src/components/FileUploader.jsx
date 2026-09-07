import { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle, Loader, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadConfig } from '../services/api'

export default function FileUploader({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState('')
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
    e.target.value = ''
  }

  const handleFile = async (file) => {
    const allowedExtensions = ['.txt', '.conf', '.cfg', '.json', '.log']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}`)
      return
    }

    setIsUploading(true)
    setUploadResult(null)
    setUploadStage('Importing configuration…')

    try {
      // Simulate staged progress for UX
      setTimeout(() => setUploadStage('Detecting vendor…'), 400)
      setTimeout(() => setUploadStage('Normalizing security model…'), 800)

      const result = await uploadConfig(file)
      setUploadStage('')
      setUploadResult(result)
      toast.success('Configuration imported successfully')
      onUploadSuccess?.(result)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Import failed. Check the file and try again.'
      toast.error(msg)
      setUploadStage('')
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
        role="button"
        tabIndex={0}
        aria-label="Upload configuration file"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.conf,.cfg,.json,.log"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {isUploading ? (
          <>
            <div className="upload-zone-icon">
              <Loader size={22} className="animate-pulse" />
            </div>
            <div className="upload-zone-title">{uploadStage || 'Processing…'}</div>
            <div className="upload-zone-subtitle">Analyzing vendor configuration</div>
          </>
        ) : (
          <>
            <div className="upload-zone-icon">
              <UploadCloud size={22} />
            </div>
            <div className="upload-zone-title">
              Drop configuration file here or <span style={{ color: 'var(--accent-light)' }}>browse</span>
            </div>
            <div className="upload-zone-subtitle">
              TXT · CFG · CONF · LOG · JSON — Vendor detection is automatic
            </div>
          </>
        )}
      </div>

      {uploadResult && (
        <div className="panel mt-16" style={{ borderColor: 'var(--color-pass-border)' }}>
          {/* Workflow completion indicator */}
          <div className="flex items-center gap-8 mb-12">
            <CheckCircle size={16} color="var(--color-pass)" />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-pass)' }}>Configuration Imported</span>
          </div>

          {/* Workflow steps visualization */}
          <div className="flex items-center gap-4 mb-16" style={{ flexWrap: 'wrap' }}>
            {[
              { label: 'Import', done: true },
              { label: 'Identify', done: true },
              { label: 'Normalize', done: true },
              { label: 'Ready', done: true },
            ].map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ width: 16, height: 1, background: 'var(--color-pass-border)', display: 'block' }} />}
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: 'var(--color-pass)', fontWeight: 500,
                }}>
                  <Check size={11} /> {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="detail-grid" style={{ margin: 0 }}>
            <div className="detail-item">
              <label>Hostname</label>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{uploadResult.device?.hostname}</span>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{uploadResult.device?.os_version}</span>
            </div>
            <div className="detail-item">
              <label>Filename</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{uploadResult.config_file?.filename}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
