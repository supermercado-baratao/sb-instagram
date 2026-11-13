ALTER TABLE `radio_script_template` ADD `opening` text;--> statement-breakpoint
ALTER TABLE `radio_script_template` ADD `closings` text;--> statement-breakpoint
ALTER TABLE `radio_script_template` ADD `sequence` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_radio_script_template` (
	`id` integer PRIMARY KEY,
	`blocks` text,
	`opening` text,
	`closings` text,
	`sequence` text,
	`priceMarkers` text NOT NULL,
	`speakRepeatedOnce` integer DEFAULT true NOT NULL,
	CONSTRAINT "radio_script_template_single_row" CHECK("id" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_radio_script_template`(`id`, `blocks`, `priceMarkers`, `speakRepeatedOnce`) SELECT `id`, `blocks`, `priceMarkers`, `speakRepeatedOnce` FROM `radio_script_template`;--> statement-breakpoint
DROP TABLE `radio_script_template`;--> statement-breakpoint
ALTER TABLE `__new_radio_script_template` RENAME TO `radio_script_template`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `radio_script_product_blocks`;