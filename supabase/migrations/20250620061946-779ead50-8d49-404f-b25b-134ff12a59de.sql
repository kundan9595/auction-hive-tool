
-- Create enum types
CREATE TYPE auction_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE auction_type AS ENUM ('closed');

-- Create profiles table for admin users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  auction_type auction_type NOT NULL DEFAULT 'closed',
  max_budget_per_bidder DECIMAL(10,2) NOT NULL,
  status auction_status NOT NULL DEFAULT 'draft',
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create collections table
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  starting_bid DECIMAL(10,2) NOT NULL,
  inventory INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  bidder_name TEXT NOT NULL,
  bidder_email TEXT,
  bid_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(auction_id, item_id, bidder_name)
);

-- Create auction results table (for when auction is closed)
CREATE TABLE public.auction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  winning_bid_id UUID REFERENCES public.bids(id),
  winner_name TEXT,
  winning_amount DECIMAL(10,2),
  quantity_sold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(auction_id, item_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for auctions
CREATE POLICY "Admins can manage their own auctions" ON public.auctions
  FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "Public can view active auctions" ON public.auctions
  FOR SELECT USING (status = 'active');

-- RLS Policies for collections
CREATE POLICY "Admins can manage collections in their auctions" ON public.collections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = collections.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );

CREATE POLICY "Public can view collections in active auctions" ON public.collections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = collections.auction_id 
      AND auctions.status = 'active'
    )
  );

-- RLS Policies for items
CREATE POLICY "Admins can manage items in their collections" ON public.items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.collections 
      JOIN public.auctions ON auctions.id = collections.auction_id
      WHERE collections.id = items.collection_id 
      AND auctions.admin_id = auth.uid()
    )
  );

CREATE POLICY "Public can view items in active auctions" ON public.items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections 
      JOIN public.auctions ON auctions.id = collections.auction_id
      WHERE collections.id = items.collection_id 
      AND auctions.status = 'active'
    )
  );

-- RLS Policies for bids
CREATE POLICY "Admins can view bids in their auctions" ON public.bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert bids in active auctions" ON public.bids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.status = 'active'
    )
  );

-- RLS Policies for auction results
CREATE POLICY "Admins can manage results for their auctions" ON public.auction_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = auction_results.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );

CREATE POLICY "Public can view results of closed auctions" ON public.auction_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = auction_results.auction_id 
      AND auctions.status = 'closed'
    )
  );

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to generate unique auction slug
CREATE OR REPLACE FUNCTION public.generate_auction_slug(auction_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from auction name
  base_slug := lower(regexp_replace(trim(auction_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'auction';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append counter if needed
  WHILE EXISTS (SELECT 1 FROM public.auctions WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_auctions_admin_id ON public.auctions(admin_id);
CREATE INDEX idx_auctions_slug ON public.auctions(slug);
CREATE INDEX idx_auctions_status ON public.auctions(status);
CREATE INDEX idx_collections_auction_id ON public.collections(auction_id);
CREATE INDEX idx_items_collection_id ON public.items(collection_id);
CREATE INDEX idx_bids_auction_id ON public.bids(auction_id);
CREATE INDEX idx_bids_item_id ON public.bids(item_id);
CREATE INDEX idx_bids_bidder_name ON public.bids(bidder_name);
CREATE INDEX idx_auction_results_auction_id ON public.auction_results(auction_id);
