import "@testing-library/jest-dom/vitest";

// Several modules build a Supabase client at import time. Unit tests never talk
// to a real project — these placeholders just let the modules load. Deliberately
// obvious fakes so a test that accidentally makes a network call fails loudly
// rather than touching the live database.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key-not-real";
process.env.ANTHROPIC_API_KEY ||= "sk-ant-test-not-real";
