-- The default only fills the existing rows before the UPDATE below; saveProduct always writes it.
ALTER TABLE `products` ADD `description` text NOT NULL DEFAULT '';--> statement-breakpoint
-- The brand is left out when it has no letters or digits (a placeholder such as "-") or is already
-- in the name ("Café Pilão" with the brand "Pilão"). lower() folds only ASCII, so a brand with an
-- accented letter in another case is appended. GLOB ranges compare code points, so Latin-1 letters count.
UPDATE `products` SET `description` = CASE
  WHEN `brand` GLOB '*[0-9A-Za-zÀ-ÖØ-öø-ÿ]*'
    AND instr(lower(`name`), lower(trim(`brand`))) = 0
    THEN trim(`name`) || ' ' || trim(`brand`)
  ELSE trim(`name`)
END;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `brand`;
