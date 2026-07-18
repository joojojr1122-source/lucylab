export type TransformKind = "avatar" | "background";

export interface LucyState {
  prompt: string;
  referenceImageUrl?: string;
  enhance?: boolean;
}

export interface JoinRequest {
  room: string;
  identity: string;
  displayName: string;
}

export interface TokenResponse {
  url: string;
  token: string;
}

export interface ConnectionConfig {
  falEndpoint: string;
  publicServerUrl: string;
  stripeEnabled: boolean;
  googleEnabled?: boolean;
  identityEnabled?: boolean;
}

export const DEFAULT_TRANSFORMS: Record<TransformKind, LucyState> = {
  avatar: {
    prompt:
      "Substitute the character in the video with the person in the reference image, preserving pose and motion.",
    enhance: true,
  },
  background: {
    prompt:
      "Replace the background with a clean professional studio gradient, keeping the person and lighting intact.",
    enhance: true,
  },
};
