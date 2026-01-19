/*
  # Fix Search Path for calculate_distance (numeric variant)
  
  ## Overview
  The calculate_distance function has two overloaded versions - one with double precision
  and one with numeric parameters. The numeric version was missing the immutable search_path.
  
  ## Changes Made
  - Add SECURITY DEFINER and SET search_path to the numeric variant of calculate_distance
  
  ## Impact
  - Prevents search_path manipulation security vulnerabilities
  - Both function overloads now have consistent security settings
*/

CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 numeric,
  lon1 numeric,
  lat2 numeric,
  lon2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  radius decimal := 6371; -- Earth's radius in kilometers
  dlat decimal;
  dlon decimal;
  a decimal;
  c decimal;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
  
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN radius * c;
END;
$$;
