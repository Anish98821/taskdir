import type { Provider } from "@/lib/agent-types";

interface MonogramSpec {
  bg: string;
  fg: string;
  letter: string;
  label: string;
}

const SPEC: Record<Provider, MonogramSpec> = {
  anthropic: { bg: "#D97757", fg: "#FFFFFF", letter: "A", label: "Anthropic" },
  openai:    { bg: "#10A37F", fg: "#FFFFFF", letter: "O", label: "OpenAI" },
  google:    { bg: "#4285F4", fg: "#FFFFFF", letter: "G", label: "Google" },
  meta:      { bg: "#0866FF", fg: "#FFFFFF", letter: "M", label: "Meta" },
  mistral:   { bg: "#FA6F2F", fg: "#FFFFFF", letter: "M", label: "Mistral" },
  xai:       { bg: "#0F0F0F", fg: "#FFFFFF", letter: "X", label: "xAI" },
  cohere:    { bg: "#E07A8B", fg: "#FFFFFF", letter: "C", label: "Cohere" },
  deepseek:  { bg: "#4D6BFE", fg: "#FFFFFF", letter: "D", label: "DeepSeek" },
  custom:    { bg: "#6B7280", fg: "#FFFFFF", letter: "•", label: "Custom" },
};

interface ProviderIconProps {
  provider: Provider;
  size?: number;
  className?: string;
}

export function ProviderIcon({ provider, size = 12, className }: ProviderIconProps) {
  const spec = SPEC[provider] ?? SPEC.custom;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-label={spec.label}
      role="img"
    >
      <rect width="16" height="16" rx="4" fill={spec.bg} />
      <text
        x="8"
        y="11.5"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="10"
        fontWeight="700"
        fill={spec.fg}
      >
        {spec.letter}
      </text>
    </svg>
  );
}

export function providerLabel(provider: Provider): string {
  return (SPEC[provider] ?? SPEC.custom).label;
}
