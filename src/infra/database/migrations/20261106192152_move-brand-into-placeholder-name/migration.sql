-- Before #84 the poster highlighted the brand, so stores filled the name with a placeholder ("-")
-- and wrote the description in the brand. GLOB ranges compare code points, so Latin-1 letters count.
UPDATE `products` SET `name` = trim(`brand`), `brand` = NULL
WHERE `name` NOT GLOB '*[0-9A-Za-zÀ-ÖØ-öø-ÿ]*'
  AND `brand` GLOB '*[0-9A-Za-zÀ-ÖØ-öø-ÿ]*';
