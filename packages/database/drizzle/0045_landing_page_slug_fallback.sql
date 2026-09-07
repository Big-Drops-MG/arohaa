UPDATE "landing_page"
SET "slug" = 'landing-' || lower(
  regexp_replace("publicId", '[^a-zA-Z0-9]+', '', 'g')
)
WHERE trim(
  both '-' FROM regexp_replace(lower("brandName"), '[^a-z0-9]+', '-', 'g')
) = ''
  AND "slug" ~ '^landing-page(-[0-9]+)?$';
