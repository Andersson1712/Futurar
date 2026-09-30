export type SecretName = 'GEMINI_API_KEY';

export interface SecretProvider {
  get(name: SecretName): string | undefined;
}
