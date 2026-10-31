CREATE TABLE `radio_script_template` (
	`id` integer PRIMARY KEY,
	`opening` text NOT NULL,
	`beforeBlock` text NOT NULL,
	`afterBlock` text NOT NULL,
	`closing` text NOT NULL,
	`priceMarkers` text NOT NULL,
	CONSTRAINT "radio_script_template_single_row" CHECK("id" = 1)
);
--> statement-breakpoint
ALTER TABLE `offer_generations` ADD `radioScript` text;