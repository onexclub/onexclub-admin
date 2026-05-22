/**
 * Minimal Deno globals for Supabase Edge Functions.
 * Runtime is Deno 2 (see `deno_version` in supabase/config.toml).
 * For full typings, enable the Deno VS Code extension on this folder.
 */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}
