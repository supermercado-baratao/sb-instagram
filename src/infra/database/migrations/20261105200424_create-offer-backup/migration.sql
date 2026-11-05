CREATE TABLE `offer_backup` (
	`id` integer PRIMARY KEY,
	`content` text NOT NULL,
	`replacedAt` integer NOT NULL,
	CONSTRAINT "offer_backup_single_row" CHECK("id" = 1)
);
