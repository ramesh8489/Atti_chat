import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageInput } from '../components/chat/MessageInput';
import { MessageList } from '../components/chat/MessageList';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import * as apiClient from '../services/apiClient';
import { Message } from '../types';

vi.mock('../services/apiClient', () => ({
  fetchConversationsApi: vi.fn(),
  fetchConversationMessagesApi: vi.fn(),
  createDirectConversationApi: vi.fn(),
  createGroupConversationApi: vi.fn(),
  sendMessageApi: vi.fn(),
  markConversationReadApi: vi.fn(),
  searchUsersApi: vi.fn(),
  requestAttachmentPresignApi: vi.fn(),
  uploadAttachmentFile: vi.fn(),
  confirmAttachmentUploadApi: vi.fn(),
  getAttachmentDownloadUrlApi: vi.fn(),
}));

vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingStart: vi.fn(),
    sendTypingStop: vi.fn(),
    markAsRead: vi.fn(),
    onReceiveMessage: vi.fn(() => () => {}),
    onUserOnline: vi.fn(() => () => {}),
    onUserOffline: vi.fn(() => () => {}),
    onTypingStart: vi.fn(() => () => {}),
    onTypingStop: vi.fn(() => () => {}),
    onMessageRead: vi.fn(() => () => {}),
    getSocket: vi.fn(() => null),
  },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/mock-blob-uuid');
global.URL.revokeObjectURL = vi.fn();

describe('Media Attachments & Secure Storage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      activeConversationId: 'conv-real-1',
      messages: {},
      isUploadingAttachment: false,
      uploadProgress: 0,
      uploadError: null,
    });
    useAuthStore.setState({
      token: 'mock-valid-jwt',
      user: {
        id: 'usr-1',
        phoneNumber: '+919876543210',
        displayName: 'Test User',
        username: 'testuser',
        isOnline: true,
      },
    });
  });

  describe('MessageInput Attachment Flow', () => {
    it('renders attachment trigger button and file input', () => {
      render(<MessageInput />);
      const attachButton = screen.getByLabelText('Attach file');
      expect(attachButton).toBeInTheDocument();
    });

    it('displays preview drawer when a file is selected', async () => {
      const { container } = render(<MessageInput />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const testFile = new File(['mock content'], 'sample.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      expect(screen.getByText('sample.pdf')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove attachment')).toBeInTheDocument();
    });

    it('clears preview when remove button is clicked', async () => {
      const { container } = render(<MessageInput />);
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      const testFile = new File(['mock image'], 'photo.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      expect(screen.getByText('photo.png')).toBeInTheDocument();

      const removeBtn = screen.getByLabelText('Remove attachment');
      fireEvent.click(removeBtn);

      expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
    });
  });

  describe('chatStore Attachment Action & Security Validation', () => {
    it('rejects executable file (.exe) with security error', async () => {
      const badFile = new File(['MZ payload'], 'malware.exe', { type: 'application/octet-stream' });

      await expect(
        useChatStore.getState().uploadAndSendAttachment(badFile, 'check this', 'token', 'usr-1')
      ).rejects.toThrow(/Forbidden file type/);

      expect(useChatStore.getState().uploadError).toMatch(/Forbidden file type/);
    });

    it('rejects oversized image (> 10MB) with limit error', async () => {
      const hugeImage = new File([new Uint8Array(12 * 1024 * 1024)], 'huge.jpg', {
        type: 'image/jpeg',
      });

      await expect(
        useChatStore.getState().uploadAndSendAttachment(hugeImage, 'huge', 'token', 'usr-1')
      ).rejects.toThrow(/exceeds the maximum allowed limit of 10 MB/);

      expect(useChatStore.getState().uploadError).toMatch(/exceeds the maximum allowed limit of 10 MB/);
    });

    it('executes full upload flow in authenticated mode: presign -> upload -> confirm', async () => {
      const goodDoc = new File(['hello world'], 'notes.txt', { type: 'text/plain' });

      (apiClient.requestAttachmentPresignApi as any).mockResolvedValue({
        success: true,
        uploadUrl: 'http://localhost:5000/api/conversations/conv-real-1/attachments/local-upload',
        fileKey: 'conv-real-1/uuid-notes.txt',
        storageMode: 'LOCAL',
        sanitizedFilename: 'notes.txt',
        fileType: 'FILE',
      });

      (apiClient.uploadAttachmentFile as any).mockResolvedValue(undefined);

      (apiClient.confirmAttachmentUploadApi as any).mockResolvedValue({
        id: 'msg-confirmed-101',
        conversationId: 'conv-real-1',
        senderId: 'usr-1',
        senderName: 'Test User',
        content: 'Check notes',
        type: 'FILE',
        createdAt: new Date().toISOString(),
        status: 'SENT',
        attachments: [
          {
            id: 'att-saved-1',
            fileKey: 'conv-real-1/uuid-notes.txt',
            fileUrl: 'http://localhost:5000/uploads/conv-real-1/uuid-notes.txt',
            fileType: 'FILE',
            fileSize: 11,
            mimeType: 'text/plain',
            fileName: 'notes.txt',
          },
        ],
      });

      await useChatStore
        .getState()
        .uploadAndSendAttachment(goodDoc, 'Check notes', 'mock-valid-jwt', 'usr-1');

      expect(apiClient.requestAttachmentPresignApi).toHaveBeenCalledWith(
        'mock-valid-jwt',
        'conv-real-1',
        expect.objectContaining({ fileName: 'notes.txt' })
      );
      expect(apiClient.uploadAttachmentFile).toHaveBeenCalled();
      expect(apiClient.confirmAttachmentUploadApi).toHaveBeenCalledWith(
        'mock-valid-jwt',
        'conv-real-1',
        expect.objectContaining({ fileKey: 'conv-real-1/uuid-notes.txt' })
      );

      const msgs = useChatStore.getState().messages['conv-real-1'];
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe('msg-confirmed-101');
      expect(msgs[0].attachments?.[0].fileName).toBe('notes.txt');
    });

    it('handles preview mode locally without API calls', async () => {
      useChatStore.setState({ activeConversationId: 'conv-preview-1' });

      const imgFile = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
      await useChatStore
        .getState()
        .uploadAndSendAttachment(imgFile, 'My avatar', undefined, 'usr-preview');

      expect(apiClient.requestAttachmentPresignApi).not.toHaveBeenCalled();
      expect(apiClient.confirmAttachmentUploadApi).not.toHaveBeenCalled();

      const previewMsgs = useChatStore.getState().messages['conv-preview-1'];
      expect(previewMsgs.length).toBeGreaterThan(0);
      const lastMsg = previewMsgs[previewMsgs.length - 1];
      expect(lastMsg.attachments?.[0].fileName).toBe('avatar.png');
      expect(lastMsg.type).toBe('IMAGE');
    });
  });

  describe('MessageList Attachment Rendering', () => {
    it('renders image attachment and allows click to download', async () => {
      const mockImageMessage: Message = {
        id: 'msg-img-1',
        conversationId: 'conv-real-1',
        senderId: 'usr-2',
        senderName: 'Deepa',
        content: 'Check this diagram',
        type: 'IMAGE',
        createdAt: new Date().toISOString(),
        status: 'SENT',
        isOutgoing: false,
        attachments: [
          {
            id: 'att-img-1',
            fileKey: 'conv-real-1/diagram.png',
            fileUrl: 'http://localhost:5000/uploads/conv-real-1/diagram.png',
            fileType: 'IMAGE',
            fileSize: 1024 * 500,
            mimeType: 'image/png',
            fileName: 'diagram.png',
          },
        ],
      };

      (apiClient.getAttachmentDownloadUrlApi as any).mockResolvedValue({
        success: true,
        downloadUrl: 'http://localhost:5000/api/attachments/att-img-1/download',
      });

      render(<MessageList messages={[mockImageMessage]} />);

      const img = screen.getByAltText('diagram.png');
      expect(img).toBeInTheDocument();
      expect(screen.getByText('Check this diagram')).toBeInTheDocument();

      fireEvent.click(img);

      await waitFor(() => {
        expect(apiClient.getAttachmentDownloadUrlApi).toHaveBeenCalledWith(
          'mock-valid-jwt',
          'att-img-1'
        );
      });
    });

    it('renders document card with icon, size, and download button', async () => {
      const mockDocMessage: Message = {
        id: 'msg-doc-1',
        conversationId: 'conv-real-1',
        senderId: 'usr-1',
        senderName: 'You',
        content: 'Quarterly report',
        type: 'FILE',
        createdAt: new Date().toISOString(),
        status: 'SENT',
        isOutgoing: true,
        attachments: [
          {
            id: 'att-doc-1',
            fileKey: 'conv-real-1/report.pdf',
            fileUrl: 'http://localhost:5000/uploads/conv-real-1/report.pdf',
            fileType: 'FILE',
            fileSize: 1024 * 1024 * 2.5,
            mimeType: 'application/pdf',
            fileName: 'report.pdf',
          },
        ],
      };

      (apiClient.getAttachmentDownloadUrlApi as any).mockResolvedValue({
        success: true,
        downloadUrl: 'http://localhost:5000/api/attachments/att-doc-1/download',
      });

      render(<MessageList messages={[mockDocMessage]} />);

      expect(screen.getByText('report.pdf')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('2.5 MB')).toBeInTheDocument();

      const downloadBtn = screen.getByLabelText('Download report.pdf');
      expect(downloadBtn).toBeInTheDocument();

      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(apiClient.getAttachmentDownloadUrlApi).toHaveBeenCalledWith(
          'mock-valid-jwt',
          'att-doc-1'
        );
      });
    });

    it('renders video attachment element', () => {
      const mockVideoMessage: Message = {
        id: 'msg-vid-1',
        conversationId: 'conv-real-1',
        senderId: 'usr-2',
        senderName: 'Deepa',
        content: 'Demo clip',
        type: 'VIDEO',
        createdAt: new Date().toISOString(),
        status: 'SENT',
        isOutgoing: false,
        attachments: [
          {
            id: 'att-vid-1',
            fileKey: 'conv-real-1/clip.mp4',
            fileUrl: 'http://localhost:5000/uploads/conv-real-1/clip.mp4',
            fileType: 'VIDEO',
            fileSize: 1024 * 1024 * 8,
            mimeType: 'video/mp4',
            fileName: 'clip.mp4',
          },
        ],
      };

      const { container } = render(<MessageList messages={[mockVideoMessage]} />);
      const videoEl = container.querySelector('video');
      expect(videoEl).toBeInTheDocument();
      expect(videoEl?.getAttribute('src')).toBe('http://localhost:5000/uploads/conv-real-1/clip.mp4');
    });
  });
});
