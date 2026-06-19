CREATE TABLE IF NOT EXISTS "pe_daily_metrics" (
	"symbol" varchar(20) NOT NULL,
	"trade_date" text NOT NULL,
	"price" real NOT NULL,
	"eps_ttm" real,
	"pe_daily" real,
	"avg_pe_5y" real,
	"eps_window_quarter_ends" text,
	"calculation_version" integer DEFAULT 1 NOT NULL,
	"calculated_at" text NOT NULL,
	CONSTRAINT "pe_daily_metrics_symbol_trade_date_unique" UNIQUE("symbol","trade_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_daily_prices" (
	"symbol" varchar(20) NOT NULL,
	"trade_date" text NOT NULL,
	"close" real NOT NULL,
	"adjusted_close" real,
	"source" text DEFAULT 'yahoo' NOT NULL,
	"fetched_at" text NOT NULL,
	CONSTRAINT "pe_daily_prices_symbol_trade_date_unique" UNIQUE("symbol","trade_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_dataset_status" (
	"symbol" varchar(20) PRIMARY KEY NOT NULL,
	"window_start_date" text,
	"window_end_date" text,
	"last_price_date_stored" text,
	"last_quarter_available_date_stored" text,
	"last_full_rebuild_at" text,
	"last_incremental_refresh_at" text,
	"calculation_version" integer DEFAULT 1 NOT NULL,
	"data_completeness_status" text DEFAULT 'partial' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_hypothetical_orders" (
	"order_id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"order_type" text NOT NULL,
	"trade_date" text NOT NULL,
	"trade_price" real NOT NULL,
	"shares" real NOT NULL,
	"notional" real NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_quarterly_eps" (
	"symbol" varchar(20) NOT NULL,
	"fiscal_period_end" text NOT NULL,
	"available_date" text NOT NULL,
	"eps" real,
	"diluted_eps" real,
	"source" text DEFAULT 'yahoo' NOT NULL,
	"fetched_at" text NOT NULL,
	CONSTRAINT "pe_quarterly_eps_symbol_fiscal_period_end_unique" UNIQUE("symbol","fiscal_period_end")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_securities" (
	"symbol" varchar(20) PRIMARY KEY NOT NULL,
	"asset_type" text,
	"exchange" text,
	"currency" text,
	"is_pe_supported" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
