export interface CapacitorPosthogPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
