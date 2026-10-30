CREATE TABLE `offer_generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`offerId` integer NOT NULL,
	`number` integer NOT NULL,
	`offerExport` text NOT NULL,
	`pageCount` integer NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_offer_generations_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_generations_offer_id_number_unique` ON `offer_generations` (`offerId`,`number`);