import { ConversationPage } from '@renderer/features/conversation';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: ConversationPage,
});
