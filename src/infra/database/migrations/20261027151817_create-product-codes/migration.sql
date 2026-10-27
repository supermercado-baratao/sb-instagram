CREATE TABLE `product_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`productCode` text NOT NULL,
	CONSTRAINT `fk_product_codes_productCode_products_code_fk` FOREIGN KEY (`productCode`) REFERENCES `products`(`code`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `product_codes_product_code_index` ON `product_codes` (`productCode`);