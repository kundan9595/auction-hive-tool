
-- Drop the existing restrictive policy for bids insertion
DROP POLICY IF EXISTS "Anyone can insert bids in active auctions" ON public.bids;

-- Create a new policy that allows anyone to insert bids in active auctions
-- without requiring authentication
CREATE POLICY "Allow anonymous bids in active auctions" ON public.bids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.status = 'active'
    )
  );

-- Also update the select policy to allow anonymous users to view bids
-- (this might be needed for the admin monitoring)
DROP POLICY IF EXISTS "Admins can view bids in their auctions" ON public.bids;

-- Allow admins to view bids in their auctions (authenticated users only)
CREATE POLICY "Admins can view bids in their auctions" ON public.bids
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );

-- Allow anonymous users to view bids for transparency (optional - you can remove this if you don't want public bid visibility)
CREATE POLICY "Public can view bids in active auctions" ON public.bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.status = 'active'
    )
  );
