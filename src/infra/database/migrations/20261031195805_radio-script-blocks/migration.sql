-- SQLite only adds a NOT NULL column with a default; the row saved with the old fixed texts starts
-- over from a single products block, since its texts can't be placed in the new sequence
ALTER TABLE `radio_script_template` ADD `blocks` text NOT NULL DEFAULT '[{"type":"products","pageCount":1}]';--> statement-breakpoint
ALTER TABLE `radio_script_template` DROP COLUMN `opening`;--> statement-breakpoint
ALTER TABLE `radio_script_template` DROP COLUMN `beforeBlock`;--> statement-breakpoint
ALTER TABLE `radio_script_template` DROP COLUMN `afterBlock`;--> statement-breakpoint
ALTER TABLE `radio_script_template` DROP COLUMN `closing`;--> statement-breakpoint
-- The first format of the script (version 1) was never released, so its generations simply lose it
UPDATE `offer_generations` SET `radioScript` = NULL WHERE json_extract(`radioScript`, '$.version') = 1;
