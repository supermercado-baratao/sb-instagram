CREATE TABLE `brand` (
	`id` integer PRIMARY KEY,
	`name` text NOT NULL,
	`slogan` text NOT NULL,
	`instagram` text NOT NULL,
	`logo` text,
	`updatedAt` integer NOT NULL,
	CONSTRAINT "brand_single_row" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`primaryColor` text NOT NULL,
	`accentColor` text NOT NULL,
	`position` integer NOT NULL
);
