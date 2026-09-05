/**
 * API Service Layer — Axios instance and all endpoint functions.
 * Maps to the FastAPI backend at /api/v1/*.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Upload & Devices ──────────────────────────────────────
export async function uploadConfig(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listDevices() {
  const { data } = await api.get('/devices')
  return data
}

export async function getDevice(deviceId) {
  const { data } = await api.get(`/devices/${deviceId}`)
  return data
}

export async function deleteDevice(deviceId) {
  const { data } = await api.delete(`/devices/${deviceId}`)
  return data
}

// ─── Compliance Audit ──────────────────────────────────────
export async function triggerAudit(deviceId, framework = 'CIS') {
  const { data } = await api.post('/audit', { device_id: deviceId, framework })
  return data
}

export async function triggerBulkAudit(deviceIds, framework = 'CIS') {
  const { data } = await api.post('/audit/bulk', { device_ids: deviceIds, framework })
  return data
}

export async function getAuditResults(deviceId, framework = null) {
  const params = framework ? { framework } : {}
  const { data } = await api.get(`/audit/results/${deviceId}`, { params })
  return data
}

export async function getAuditSummary(deviceId, framework = 'CIS') {
  const { data } = await api.get(`/audit/summary/${deviceId}`, { params: { framework } })
  return data
}

// ─── Dashboard ─────────────────────────────────────────────
export async function getDashboardStats() {
  const { data } = await api.get('/dashboard/stats')
  return data
}

export async function getRiskDistribution() {
  const { data } = await api.get('/dashboard/risk-distribution')
  return data
}

// ─── Training ──────────────────────────────────────────────
export async function getPendingTraining() {
  const { data } = await api.get('/training/pending')
  return data
}

export async function submitMapping(mappingId, securityCategory, normalizedKey, normalizedValue) {
  const { data } = await api.post('/training/map', {
    mapping_id: mappingId,
    security_category: securityCategory,
    normalized_key: normalizedKey,
    normalized_value: normalizedValue,
  })
  return data
}

export async function getAllMappings(vendor = null, verifiedOnly = false) {
  const params = {}
  if (vendor) params.vendor = vendor
  if (verifiedOnly) params.verified_only = true
  const { data } = await api.get('/training/mappings', { params })
  return data
}

export async function deleteMapping(mappingId) {
  const { data } = await api.delete(`/training/mappings/${mappingId}`)
  return data
}

export async function loadDemoUnknownConfig() {
  const { data } = await api.post('/training/demo/load')
  return data
}

export async function reAuditDevice(deviceId, framework = 'CIS') {
  const { data } = await api.post(`/training/re-audit/${deviceId}`, null, {
    params: { framework },
  })
  return data
}

// ─── Reports ───────────────────────────────────────────────
export async function generateReport(deviceId, framework = 'CIS') {
  const { data } = await api.post(`/reports/generate/${deviceId}`, null, {
    params: { framework },
  })
  return data
}

export function getReportDownloadUrl(reportId) {
  return `/api/v1/reports/download/${reportId}`
}

export async function listReports() {
  const { data } = await api.get('/reports')
  return data
}

export default api
