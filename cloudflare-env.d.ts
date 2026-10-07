declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    SUPABASE_URL?: string;
    SUPABASE_GATEWAY_PRIVATE_JWK?: string;
    BUCKET?: R2Bucket;
  }
}
