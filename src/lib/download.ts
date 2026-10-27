export function createPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes) as BlobPart], { type: 'application/pdf' });
}
