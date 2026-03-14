'use client';

import ChatContainer from '@/components/chat/ChatContainer';
import { useGenerateSong } from '@/hooks/useGenerateSong';

export default function ChatPage() {
  const { messages, isGenerating, sendMessage } = useGenerateSong();

  return (
    <ChatContainer
      messages={messages}
      onSend={sendMessage}
      isGenerating={isGenerating}
    />
  );
}
