declare namespace Cloudflare {
  interface Env {
    GOOGLE_DRIVE_CLIENT_ID?: string;
    GOOGLE_PICKER_API_KEY?: string;
    GOOGLE_DRIVE_APP_ID?: string;
    DB?: D1Database;
    SUPABASE_URL?: string;
    SUPABASE_GATEWAY_PRIVATE_JWK?: string;
    BUCKET?: R2Bucket;
  }
}
