CREATE TABLE IF NOT EXISTS "pe_daily_metrics" (
	"id" varchar PRIMARY KEY NOT NULL,
	"security_id" varchar NOT NULL,
	"date" text NOT NULL,
	"pe_ratio" real
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_daily_prices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"security_id" varchar NOT NULL,
	"date" text NOT NULL,
	"adj_close" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_dataset_status" (
	"security_id" varchar PRIMARY KEY NOT NULL,
	"last_backfill_at" text,
	"last_incremental_refresh_at" text,
	"status" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_hypothetical_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"security_id" varchar NOT NULL,
	"side" varchar NOT NULL,
	"date" text NOT NULL,
	"price" real NOT NULL,
	"shares" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_quarterly_eps" (
	"id" varchar PRIMARY KEY NOT NULL,
	"security_id" varchar NOT NULL,
	"quarter_end" text NOT NULL,
	"eps" real NOT NULL,
	"source" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pe_securities" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "screeners" (
	"key" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_screener_access" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"screener_key" varchar NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"restricted_at" text NOT NULL,
	"restricted_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"email" varchar,
	"password" text NOT NULL,
	"role" varchar NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"totp_secret" text,
	"created_at" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
