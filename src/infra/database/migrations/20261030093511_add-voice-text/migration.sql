CREATE TABLE `pronunciations` (
	`term` text PRIMARY KEY NOT NULL,
	`spoken` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `voiceText` text;