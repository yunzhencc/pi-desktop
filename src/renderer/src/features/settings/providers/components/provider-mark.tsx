import type { ProviderId, ProviderSnapshot } from '../../../../../../main/provider-settings';
import AntGroupIcon from '@lobehub/icons/es/AntGroup/components/Color.js';
import AnthropicIcon from '@lobehub/icons/es/Anthropic/components/Mono.js';
import AwsIcon from '@lobehub/icons/es/Aws/components/Color.js';
import AzureIcon from '@lobehub/icons/es/Azure/components/Color.js';
import CerebrasIcon from '@lobehub/icons/es/Cerebras/components/Color.js';
import CloudflareIcon from '@lobehub/icons/es/Cloudflare/components/Color.js';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Color.js';
import FireworksIcon from '@lobehub/icons/es/Fireworks/components/Color.js';
import GithubCopilotIcon from '@lobehub/icons/es/GithubCopilot/components/Mono.js';
import GoogleIcon from '@lobehub/icons/es/Google/components/Color.js';
import GroqIcon from '@lobehub/icons/es/Groq/components/Mono.js';
import HuggingFaceIcon from '@lobehub/icons/es/HuggingFace/components/Color.js';
import KimiIcon from '@lobehub/icons/es/Kimi/components/Color.js';
import MinimaxIcon from '@lobehub/icons/es/Minimax/components/Color.js';
import MistralIcon from '@lobehub/icons/es/Mistral/components/Color.js';
import MoonshotIcon from '@lobehub/icons/es/Moonshot/components/Mono.js';
import NvidiaIcon from '@lobehub/icons/es/Nvidia/components/Color.js';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono.js';
import OpenCodeIcon from '@lobehub/icons/es/OpenCode/components/Mono.js';
import OpenRouterIcon from '@lobehub/icons/es/OpenRouter/components/Mono.js';
import QwenIcon from '@lobehub/icons/es/Qwen/components/Color.js';
import VercelIcon from '@lobehub/icons/es/Vercel/components/Mono.js';
import XAIIcon from '@lobehub/icons/es/XAI/components/Mono.js';
import XiaomiMiMoIcon from '@lobehub/icons/es/XiaomiMiMo/components/Mono.js';
import ZAIIcon from '@lobehub/icons/es/ZAI/components/Mono.js';
import ZhipuIcon from '@lobehub/icons/es/Zhipu/components/Color.js';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Bot } from 'lucide-react';

export function ProviderMark({ provider }: { provider: ProviderSnapshot }) {
  return (
    <span
      className={cn(
        'inline-flex size-[26px] shrink-0 basis-[26px] items-center justify-center rounded-md border border-border-subtle bg-surface text-xs font-semibold text-foreground',
        providerIconHasColor(provider.id) && 'bg-transparent',
        provider.id === 'deepseek' && 'text-[#16a34a]',
        (provider.id === 'opencode' || provider.id.startsWith('opencode-')) && 'text-[#2563eb]',
      )}
      data-provider={provider.id}
    >
      {renderProviderIcon(provider.id, provider.name)}
    </span>
  );
}

function providerIconHasColor(providerId: ProviderId): boolean {
  return [
    'amazon-bedrock',
    'ant-ling',
    'azure-openai-responses',
    'cerebras',
    'cloudflare-ai-gateway',
    'cloudflare-workers-ai',
    'deepseek',
    'fireworks',
    'google',
    'google-vertex',
    'huggingface',
    'kimi-coding',
    'minimax',
    'minimax-cn',
    'mistral',
    'nvidia',
    'qwen',
    'zhipu',
  ].includes(providerId);
}

function renderProviderIcon(providerId: ProviderId, title: string) {
  switch (providerId) {
    case 'amazon-bedrock':
      return <AwsIcon size={16} title={title} />;
    case 'ant-ling':
      return <AntGroupIcon size={16} title={title} />;
    case 'anthropic':
      return <AnthropicIcon size={16} title={title} />;
    case 'azure-openai-responses':
      return <AzureIcon size={16} title={title} />;
    case 'cerebras':
      return <CerebrasIcon size={16} title={title} />;
    case 'cloudflare-ai-gateway':
    case 'cloudflare-workers-ai':
      return <CloudflareIcon size={16} title={title} />;
    case 'deepseek':
      return <DeepSeekIcon size={16} title={title} />;
    case 'fireworks':
      return <FireworksIcon size={16} title={title} />;
    case 'github-copilot':
      return <GithubCopilotIcon size={16} title={title} />;
    case 'google':
    case 'google-vertex':
      return <GoogleIcon size={16} title={title} />;
    case 'groq':
      return <GroqIcon size={16} title={title} />;
    case 'huggingface':
      return <HuggingFaceIcon size={16} title={title} />;
    case 'kimi-coding':
      return <KimiIcon size={16} title={title} />;
    case 'minimax':
    case 'minimax-cn':
      return <MinimaxIcon size={16} title={title} />;
    case 'mistral':
      return <MistralIcon size={16} title={title} />;
    case 'moonshot':
    case 'moonshotai':
    case 'moonshotai-cn':
      return <MoonshotIcon size={16} title={title} />;
    case 'nvidia':
      return <NvidiaIcon size={16} title={title} />;
    case 'openai-codex':
      return <OpenAIIcon size={16} title={title} />;
    case 'openrouter':
      return <OpenRouterIcon size={16} title={title} />;
    case 'qwen':
      return <QwenIcon size={16} title={title} />;
    case 'vercel-ai-gateway':
      return <VercelIcon size={16} title={title} />;
    case 'xai':
      return <XAIIcon size={16} title={title} />;
    case 'xiaomi':
    case 'xiaomi-token-plan-ams':
    case 'xiaomi-token-plan-cn':
    case 'xiaomi-token-plan-sgp':
      return <XiaomiMiMoIcon size={16} title={title} />;
    case 'zai':
    case 'zai-coding-cn':
      return <ZAIIcon size={16} title={title} />;
    case 'zhipu':
      return <ZhipuIcon size={16} title={title} />;
    default:
      if (providerId === 'opencode' || providerId.startsWith('opencode-'))
        return <OpenCodeIcon size={16} title={title} />;
      return <Bot aria-label={title} size={16} strokeWidth={1.75} />;
  }
}
