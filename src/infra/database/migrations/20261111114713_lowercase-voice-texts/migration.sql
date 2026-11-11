-- The radio ad now speaks descriptions in lowercase, since capitals may be read as emphasis or
-- spelled out as an acronym (#111), so voice texts saved before it follow the same rule. lower()
-- folds only ASCII (https://sqlite.org/lang_corefunc.html#lower), so the accented capitals of
-- Portuguese are replaced first
UPDATE `products` SET `voiceText` = lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(`voiceText`, 'Á', 'á'), 'À', 'à'), 'Â', 'â'), 'Ã', 'ã'), 'Ä', 'ä'), 'É', 'é'), 'È', 'è'), 'Ê', 'ê'), 'Ë', 'ë'), 'Í', 'í'), 'Ì', 'ì'), 'Î', 'î'), 'Ï', 'ï'), 'Ó', 'ó'), 'Ò', 'ò'), 'Ô', 'ô'), 'Õ', 'õ'), 'Ö', 'ö'), 'Ú', 'ú'), 'Ù', 'ù'), 'Û', 'û'), 'Ü', 'ü'), 'Ç', 'ç'), 'Ñ', 'ñ')) WHERE `voiceText` IS NOT NULL;
