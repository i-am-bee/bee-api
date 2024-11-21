import mime from 'mime';

export const OCTET_STREAM_MIME_TYPE = 'application/octet-stream';

export function deriveMimeType(mimeType?: string, filename?: string) {
  if (mimeType && mimeType !== OCTET_STREAM_MIME_TYPE) {
    return mimeType;
  }
  if (filename) {
    const type = mime.getType(filename);
    if (type) return type;
  }
  return OCTET_STREAM_MIME_TYPE;
}
