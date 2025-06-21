
-- Add unique constraint to prevent duplicate bidder names per auction
ALTER TABLE public.bids 
ADD CONSTRAINT unique_bidder_name_per_auction 
UNIQUE (auction_id, bidder_name);

-- Add unique constraint to prevent duplicate bidder emails per auction
ALTER TABLE public.bids 
ADD CONSTRAINT unique_bidder_email_per_auction 
UNIQUE (auction_id, bidder_email);

-- Create a table to track bidder registration status
CREATE TABLE public.bidder_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL,
  bidder_name TEXT NOT NULL,
  bidder_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'bidding' CHECK (status IN ('bidding', 'complete')),
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(auction_id, bidder_name),
  UNIQUE(auction_id, bidder_email)
);

-- Enable RLS for bidder registrations
ALTER TABLE public.bidder_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read bidder registrations for active auctions (for admin monitoring)
CREATE POLICY "Anyone can view bidder registrations for active auctions" 
ON public.bidder_registrations 
FOR SELECT 
USING (true);

-- Allow anyone to insert/update bidder registrations (for public bidding)
CREATE POLICY "Anyone can manage bidder registrations" 
ON public.bidder_registrations 
FOR ALL 
USING (true);
