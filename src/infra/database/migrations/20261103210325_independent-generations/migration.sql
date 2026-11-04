CREATE TABLE `generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`number` integer NOT NULL,
	`offerExport` text NOT NULL,
	`pageCount` integer NOT NULL,
	`radioScript` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `generations`(`id`, `number`, `offerExport`, `pageCount`, `radioScript`, `createdAt`) SELECT `id`, `number`, `offerExport`, `pageCount`, `radioScript`, `createdAt` FROM `offer_generations`;--> statement-breakpoint
-- A deleted generation's id must never come back, since its files' URLs are cached as immutable
DELETE FROM `sqlite_sequence` WHERE `name` = 'generations';--> statement-breakpoint
INSERT INTO `sqlite_sequence`(`name`, `seq`) SELECT 'generations', `seq` FROM `sqlite_sequence` WHERE `name` = 'offer_generations';--> statement-breakpoint
DROP TABLE `offer_generations`;--> statement-breakpoint
CREATE UNIQUE INDEX `generations_number_unique` ON `generations` (`number`);
