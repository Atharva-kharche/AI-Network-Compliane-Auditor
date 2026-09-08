export function formatDeviceName(device) {
  if (!device) return 'UNKNOWN';
  if (device.hostname && device.hostname.toLowerCase() !== 'unknown') {
    return device.hostname;
  }
  // Fallback to a stable ID
  if (device.id) {
    const shortId = String(device.id).replace(/-/g, '').substring(0, 6).toUpperCase();
    return `UNKNOWN-${shortId}`;
  }
  return 'UNKNOWN-DEVICE';
}

export function isUnassessed(score, vendor, passed = undefined, failed = undefined) {
  // If passed and failed counts are provided, an assessment with 0 passes and 0 fails 
  // means the engine couldn't evaluate any rules (usually due to missing mappings).
  if (passed !== undefined && failed !== undefined) {
    return passed === 0 && failed === 0;
  }
  // Fallback heuristic if counts are not provided: score 0 and unknown vendor
  return score === 0 && vendor && vendor.toLowerCase() === 'unknown';
}
