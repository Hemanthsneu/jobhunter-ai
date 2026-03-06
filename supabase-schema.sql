-- ========================================
-- JobHunter AI — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ========================================

-- Users (Supabase Auth handles this automatically)
-- Just add profile data:
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'United States',
  years_of_exp INTEGER,
  work_auth TEXT, -- 'citizen', 'gc', 'h1b', 'opt', 'other'
  needs_sponsorship BOOLEAN DEFAULT FALSE,
  salary_expectation TEXT,
  target_roles TEXT[], -- array of job titles
  target_companies TEXT[],
  is_pro BOOLEAN DEFAULT FALSE,
  pro_valid_until TIMESTAMPTZ,
  monthly_usage JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resumes
CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Software Engineer Resume", "Blockchain Resume"
  content TEXT NOT NULL, -- raw resume text
  file_url TEXT, -- Supabase Storage URL for PDF
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  description TEXT,
  url TEXT,
  source TEXT, -- 'linkedin', 'indeed', 'greenhouse', 'lever', 'ashby'
  match_score INTEGER, -- 0-100
  visa_status TEXT, -- 'sponsors', 'no-sponsor', 'unclear'
  salary_range TEXT,
  remote_policy TEXT, -- 'remote', 'hybrid', 'onsite'
  h1b_sponsor BOOLEAN,
  freshness_score INTEGER,
  is_ghost_job BOOLEAN DEFAULT FALSE,
  posted_date TIMESTAMPTZ,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications (the core tracker)
CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id),
  status TEXT DEFAULT 'saved',
  -- status flow: saved → applied → phone_screen → interview → offer → rejected → ghosted
  applied_at TIMESTAMPTZ,
  interview_date TIMESTAMPTZ,
  offer_amount TEXT,
  notes TEXT,
  interviewer_name TEXT,
  follow_up_sent_at TIMESTAMPTZ,
  tailored_resume TEXT, -- the AI-tailored version for this specific job
  cover_letter TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Outputs cache (avoid re-charging API for same job)
CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  output_type TEXT, -- 'analysis', 'tailored_resume', 'cover_letter', 'interview_prep'
  content TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (CRITICAL — users can only see their own data)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_own_data') THEN
    CREATE POLICY profiles_own_data ON profiles FOR ALL USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resumes_own_data') THEN
    CREATE POLICY resumes_own_data ON resumes FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'jobs_own_data') THEN
    CREATE POLICY jobs_own_data ON jobs FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'applications_own_data') THEN
    CREATE POLICY applications_own_data ON applications FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_cache_own_data') THEN
    CREATE POLICY ai_cache_own_data ON ai_cache FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
