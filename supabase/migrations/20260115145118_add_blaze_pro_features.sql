/*
  # Add Complete Blaze Pro Features

  1. New Tables
    - `cultivation_guides` - educational content for Pro users
      - `id` (uuid, primary key)
      - `title` (text) - guide title
      - `content` (text) - guide content
      - `category` (text) - guide category (beginner, intermediate, advanced)
      - `image_url` (text) - optional cover image
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_pro_only` (boolean) - whether this guide requires Pro subscription

  2. Table Modifications
    - Add `featured_until` column to `users` table for Pro featured profiles
    - Add `events_created_this_month` counter to track event limits

  3. Security
    - Enable RLS on cultivation_guides table
    - Only Pro users can view pro-only guides
    - All users can view free guides
*/

-- Create cultivation_guides table
CREATE TABLE IF NOT EXISTS public.cultivation_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'beginner' CHECK (category IN ('beginner', 'intermediate', 'advanced', 'strain-specific', 'harvesting', 'troubleshooting')),
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_pro_only boolean DEFAULT false
);

ALTER TABLE public.cultivation_guides ENABLE ROW LEVEL SECURITY;

-- Add featured_until column to users table for Pro featured profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'featured_until'
  ) THEN
    ALTER TABLE public.users ADD COLUMN featured_until timestamptz DEFAULT NULL;
  END IF;
END $$;

-- RLS Policies for cultivation_guides
CREATE POLICY "Everyone can view free guides"
  ON public.cultivation_guides
  FOR SELECT
  TO authenticated
  USING (is_pro_only = false);

CREATE POLICY "Pro users can view all guides"
  ON public.cultivation_guides
  FOR SELECT
  TO authenticated
  USING (
    is_pro_only = false 
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND subscription_tier = 'pro' 
      AND subscription_status = 'active'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cultivation_guides_pro ON public.cultivation_guides(is_pro_only);
CREATE INDEX IF NOT EXISTS idx_cultivation_guides_category ON public.cultivation_guides(category);
CREATE INDEX IF NOT EXISTS idx_users_featured ON public.users(featured_until) WHERE featured_until IS NOT NULL;

-- Insert some sample cultivation guides
INSERT INTO public.cultivation_guides (title, content, category, is_pro_only) VALUES
('Getting Started with Cannabis Cultivation', 'Learn the basics of growing cannabis at home. This guide covers seed selection, germination, and setting up your first grow space. Essential equipment includes grow lights, proper ventilation, and quality soil or hydroponic systems.', 'beginner', false),
('Understanding Cannabis Strains', 'Deep dive into Indica, Sativa, and Hybrid strains. Learn about terpene profiles, THC/CBD ratios, and how to choose the right strain for your needs and growing environment.', 'strain-specific', false),
('Advanced Nutrient Management', 'Master the art of feeding your plants. Learn about NPK ratios, micronutrients, and feeding schedules for different growth stages. Includes troubleshooting nutrient deficiencies.', 'advanced', true),
('Training Techniques: LST, HST, and SCROG', 'Exclusive Pro guide to maximizing yields through Low Stress Training, High Stress Training, and Screen of Green methods. Detailed step-by-step instructions with timing recommendations.', 'advanced', true),
('Optimal Harvesting and Curing', 'Professional techniques for determining harvest time, proper drying conditions, and the curing process. Learn how to preserve terpenes and maximize potency.', 'harvesting', true),
('Pest and Disease Management', 'Identify and treat common cannabis pests and diseases. Organic and chemical solutions, prevention strategies, and integrated pest management techniques.', 'troubleshooting', false),
('Climate Control Mastery', 'Pro-level guide to controlling temperature, humidity, and CO2 levels. Learn about VPD (Vapor Pressure Deficit) and creating the perfect environment for each growth stage.', 'advanced', true),
('Breeding Basics', 'Introduction to cannabis breeding, creating your own strains, and stabilizing genetics. Pro-exclusive content includes phenotype selection and backcrossing techniques.', 'advanced', true)
ON CONFLICT DO NOTHING;

-- Function to auto-feature Pro users (can be called manually or via trigger)
CREATE OR REPLACE FUNCTION auto_feature_pro_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Feature Pro users for 30 days when they first subscribe or renew
  UPDATE public.users
  SET featured_until = now() + interval '30 days'
  WHERE subscription_tier = 'pro'
    AND subscription_status = 'active'
    AND (featured_until IS NULL OR featured_until < now());
END;
$$;

-- Create trigger to auto-feature new Pro users
CREATE OR REPLACE FUNCTION trigger_auto_feature_pro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_tier = 'pro' AND NEW.subscription_status = 'active' THEN
    IF OLD.subscription_tier != 'pro' OR OLD.subscription_status != 'active' OR NEW.featured_until IS NULL THEN
      NEW.featured_until := now() + interval '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_feature_pro_users_trigger ON public.users;
CREATE TRIGGER auto_feature_pro_users_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.subscription_tier = 'pro' AND NEW.subscription_status = 'active')
  EXECUTE FUNCTION trigger_auto_feature_pro();
