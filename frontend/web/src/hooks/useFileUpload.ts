import { useCallback, useRef, useState } from 'react';
import type { AttachmentPayload } from '../types';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_TYPES = ['text/markdown', 'text/plain'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function fileToAttachment(file: File): Promise<AttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (IMAGE_TYPES.includes(file.type)) {
        // Extract base64 data from data URL
        const base64 = result.split(',')[1] ?? '';
        resolve({ filename: file.name, media_type: file.type, data: base64 });
      } else {
        // Text content - read as text
        resolve({ filename: file.name, media_type: file.type || 'text/markdown', data: '' });
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    if (IMAGE_TYPES.includes(file.type)) {
      reader.readAsDataURL(file);
    } else {
      // For text files, read as text separately
      const textReader = new FileReader();
      textReader.onload = () => {
        resolve({
          filename: file.name,
          media_type: file.type || 'text/markdown',
          data: textReader.result as string,
        });
      };
      textReader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      textReader.readAsText(file);
    }
  });
}

function isAcceptedFile(file: File): boolean {
  if (file.size > MAX_FILE_SIZE) return false;
  if (IMAGE_TYPES.includes(file.type)) return true;
  if (TEXT_TYPES.includes(file.type)) return true;
  // Accept .md files even if MIME type is not set
  if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) return true;
  return false;
}

export function useFileUpload() {
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(isAcceptedFile);
    if (accepted.length === 0) return;

    const payloads = await Promise.all(accepted.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...payloads]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = ''; // reset so same file can be re-selected
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles],
  );

  return {
    attachments,
    fileInputRef,
    addFiles,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handlePaste,
  };
}
