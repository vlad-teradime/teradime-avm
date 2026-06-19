DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_screener_access_user_id_screener_key_unique'
  ) THEN
    ALTER TABLE "user_screener_access" ADD CONSTRAINT "user_screener_access_user_id_screener_key_unique" UNIQUE("user_id","screener_key");
  END IF;
END $$;