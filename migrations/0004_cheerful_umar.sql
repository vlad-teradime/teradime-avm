CREATE TABLE IF NOT EXISTS "shiller_cape_monthly" (
	"period_date" text PRIMARY KEY NOT NULL,
	"sp500_price" real NOT NULL,
	"shiller_pe" real NOT NULL,
	"earnings_base" real NOT NULL,
	"source" text DEFAULT 'shiller_dataset' NOT NULL,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shiller_dataset_status" (
	"id" varchar PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"last_shiller_month_stored" text,
	"last_price_date_stored" text,
	"last_full_rebuild_at" text,
	"last_incremental_refresh_at" text,
	"data_completeness_status" text DEFAULT 'partial' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sp500_daily_prices" (
	"trade_date" text PRIMARY KEY NOT NULL,
	"close" real NOT NULL,
	"source" text DEFAULT 'yfinance' NOT NULL,
	"fetched_at" text NOT NULL
);
