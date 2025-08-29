export interface LlamaCppPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
